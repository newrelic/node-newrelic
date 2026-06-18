/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BaseProfiler = require('./base')
const semver = require('semver')

/**
 * Produces a wall time stack profile via `pprof`.
 * The native sampler fires at a fixed rate against whatever JS is currently
 * on the stack, and the active transaction's trace/span ids are attached to
 * each sample by hooking the agent's `AsyncLocalStorage` (`this.#store`).
 *
 * With AsyncContextFrame active, pprof's `useCPED` carries the context per
 * async-context-frame; otherwise a single holder is swapped per sample.
 *
 * The wall-clock (or just wall) time for a function measures the time elapsed
 * between entering and exiting a function. Wall time includes all wait time,
 * including that for locks and thread synchronization.
 */
class CpuProfiler extends BaseProfiler {
  #pprof
  #tracer
  #durationMillis
  #intervalMicros = (1e3 / 99) * 1000 // samples at 99hz(99 times per second)
  #kSampleCount
  #useCPED
  // Readonly so it doesn't get rewritten, without it non-CPED tests fail
  DEFAULT_CONTEXT = Object.freeze({ current: {} })
  /**
   * If `#useCPED` is `false`, `pprof` captures this holder by reference at sample
   * time, so we keep `current` pointed at the active transaction's trace/span ids.
   *
   * If `#useCPED` is true, `pprof` handles this for us with `AsyncContextFrame`, so
   * this property is not used.
   */
  #context = this.DEFAULT_CONTEXT
  #state
  #lastSampleCount = 0
  /**
   * The agent's `AsyncLocalStorage` instance.
   */
  #store
  /**
   * Caches the resolved transaction name; `getFullName()` re-runs the name
   * normalizer while a transaction is in-flight, so avoid it per context change.
   */
  #nameCache = { transaction: null, name: '' }
  // Saved ALS methods, restored by `#unhookContext` on stop.
  #origRun
  #origEnterWith
  /**
   * Async hook that refreshes context on async resumption. Only required if `#useCPED` is `false`.
   */
  #asyncHook

  constructor({ logger, samplingInterval, tracer, useCPED = true }) {
    super({ logger })
    this.#pprof = require('@datadog/pprof')
    this.#kSampleCount = this.#pprof.time.constants.kSampleCount
    this.#tracer = tracer
    this.#store = tracer._contextManager._asyncLocalStorage
    this.#durationMillis = samplingInterval
    // CPED requires AsyncContextFrame which is on by default with node >=24
    // @todo should we account for `--no-async-context-frame`?
    this.#useCPED = useCPED && semver.satisfies(process.versions.node, '>=24.0.0')
  }

  start() {
    if (this.#pprof.time.isStarted()) {
      this.logger.trace('CpuProfiler is already started, not calling start again.')
      return
    }

    this.logger.trace(`Starting CpuProfiler, sample every ${this.#intervalMicros}hz for ${this.#durationMillis} ms.`)
    this.#pprof.time.start({
      durationMillis: this.#durationMillis,
      intervalMicros: this.#intervalMicros,
      // needed for trace_id + span_id label
      withContexts: true,
      // carry the sample context per async-context-frame when ACF is active
      useCPED: this.#useCPED
    })

    if (this.#useCPED) {
      this.#hookEnterWith()
    } else {
      this.#state = this.#pprof.time.getState()
      this.#resetContext()
      this.#hookRun()
      this.#hookAsyncResume()
    }
  }

  stop() {
    if (!this.#pprof.time.isStarted()) {
      this.logger.trace('CpuProfiler is not started, not stopping.')
      return
    }

    // Restore the wrapped ALS methods before stopping.
    this.#unhookContext()
    this.#pprof.time.stop(false)
  }

  async collect() {
    if (!this.#useCPED) {
      // Flush the active span before sampling restarts.
      this.#updateContext()
    }
    const profile = this.#pprof.time.stop(true, this.#linkContext)
    if (!this.#useCPED) {
      // `stop(true)` restarts sampling, so start a fresh holder.
      this.#resetContext()
    }
    return this.#pprof.encode(profile)
  }

  /**
   * pprof's `generateLabels` callback, returning the span label active when each
   * sample was taken. With CPED the captured value is the label itself; without
   * it, the label lives in the holder's `current`.
   *
   * @param {object} params params from pprof
   * @param {object} params.context the captured time profile node context
   * @returns {object} label set applied to the pprof sample
   */
  #linkContext = ({ context }) => {
    const captured = context?.context
    return this.#buildLabel(this.#useCPED ? captured : captured?.current)
  }

  /**
   * Refreshes the pprof sample context with the active span. With CPED, the label
   * is written straight into the current async-context-frame; otherwise a fresh
   * holder is swapped in once a sample has landed (so earlier samples keep their
   * ids) before reassigning its `current`.
   */
  #updateContext = () => {
    const { 'trace.id': traceId, 'span.id': spanId } = this.#tracer.agent.getLinkingMetadata(true)
    const spanContext = { traceId, spanId, transaction: this.#tracer.getTransaction() }

    if (this.#useCPED) {
      this.#pprof.time.setContext(spanContext)
      return
    }

    const sampleCount = this.#state?.[this.#kSampleCount]
    if (sampleCount !== this.#lastSampleCount || this.#context === this.DEFAULT_CONTEXT) {
      this.#lastSampleCount = sampleCount
      this.#context = spanContext ? { current: spanContext } : this.DEFAULT_CONTEXT
      this.#pprof.time.setContext(this.#context)
    } else {
      this.#context.current = spanContext
    }
  }

  /**
   * (non-CPED) Points the pprof time profiler at a fresh `#context`
   * and resyncs the sample counter.
   */
  #resetContext() {
    this.#context = this.DEFAULT_CONTEXT
    this.#lastSampleCount = this.#state?.[this.#kSampleCount] ?? 0
    this.#pprof.time.setContext(this.#context)
  }

  /**
   * Builds the single `span:` label for the active context, or `{}` when there
   * is none. The value is a comma-separated `span_id=…,trace_id=…` string.
   *
   * @todo what is the intended behavior if trace.id is unavailable? span.id? both?
   *    currently we omit one of them if it's unavailable but keep the other one.
   * @todo should we do two KVPs/labels instead? e.g. "trace_id": "xxx", "span_id": "yyy"
   *
   * @param {object} [spanContext] the captured trace/span ids and transaction
   * @returns {object} the label set (at most one `span:` entry)
   */
  #buildLabel(spanContext) {
    if (!spanContext?.traceId) {
      return {}
    }

    const { traceId, spanId } = spanContext
    // Should be in span_id, trace_id order
    const value = spanId ? `span_id=${spanId},trace_id=${traceId}` : `trace_id=${traceId}`
    return { [this.#generateKey(spanContext.transaction)]: value }
  }

  /**
   * Builds the `span:` label key: the first 16 chars of the trace id plus the
   * transaction name (`span:<traceId[0:16]>:<name>`) to match other language
   * agents' implementation.
   *
   * @todo should we do two KVPs/labels instead? e.g. "trace_id": "xxx", "span_id": "yyy"
   *
   * @param {Transaction} transaction the active transaction
   * @returns {string} the label key
   */
  #generateKey(transaction) {
    if (transaction !== this.#nameCache.transaction || !this.#nameCache.name) {
      this.#nameCache = { transaction, name: transaction.getFullName() || '' }
    }

    const prefix = `span:${transaction.traceId.slice(0, 16)}`
    return this.#nameCache.name ? `${prefix}:${this.#nameCache.name}` : prefix
  }

  /**
   * (CPED) Wraps `enterWith` on the agent's `AsyncLocalStorage`. Since `run`
   * delegates to `enterWith` under ACF, this one hook covers every context
   * switch; we then `setContext` the active span into the current frame, which
   * pprof propagates to continuations and restores on unwind.
   */
  #hookEnterWith() {
    const self = this
    this.#origEnterWith = this.#store.enterWith
    const origEnterWith = this.#origEnterWith
    this.#store.enterWith = function (store) {
      const retVal = origEnterWith.call(this, store)
      self.#updateContext()
      return retVal
    }
  }

  /**
   * (non-CPED) Wraps `run` on the agent's `AsyncLocalStorage` to refresh the
   * holder on `run` entry and exit (so a sibling doesn't inherit a returned
   * child's span). Wraps the instance, not the prototype.
   */
  #hookRun() {
    const self = this
    this.#origRun = this.#store.run
    const origRun = this.#origRun
    this.#store.run = function (store, callback, ...args) {
      function wrapped(...cbArgs) {
        self.#updateContext()
        return callback.apply(this, cbArgs)
      }
      try {
        return origRun.call(this, store, wrapped, ...args)
      } finally {
        self.#updateContext()
      }
    }
  }

  /**
   * (non-CPED) Async resumptions (timer, promise, I/O) restore the active store
   * without a `run` call, leaving the holder frozen at the last `run`'s span. A
   * `before` hook refreshes it so those samples get the right span.
   */
  #hookAsyncResume() {
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
    const { createHook } = require('async_hooks')
    this.#asyncHook = createHook({ before: () => this.#updateContext() })
    this.#asyncHook.enable()
  }

  /**
   * Restores the original `run`/`enterWith` and disables the async hook so none
   * fire once the profiler has stopped.
   */
  #unhookContext() {
    if (this.#origRun) {
      this.#store.run = this.#origRun
      this.#origRun = null
    }
    if (this.#origEnterWith) {
      this.#store.enterWith = this.#origEnterWith
      this.#origEnterWith = null
    }
    this.#asyncHook?.disable()
    this.#asyncHook = null
  }
}

module.exports = CpuProfiler
