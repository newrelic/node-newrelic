/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { AsyncLocalStorage } = require('async_hooks')
const BaseProfiler = require('./base')

/**
 * True when V8's AsyncContextFrame is active, detected by whether
 * `AsyncLocalStorage.run` delegates to `enterWith`. Feature-detected rather than
 * version-gated so it tracks `--experimental-async-context-frame` (Node 22/23)
 * and `--no-async-context-frame` (Node 24+).
 */
const ASYNC_CONTEXT_FRAME_ACTIVE = (() => {
  let active = false
  const als = new AsyncLocalStorage()
  als.enterWith = () => {
    active = true
  }
  als.run(1, () => {})
  als.disable()
  return active
})()

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
  // (non-CPED) pprof captures this holder by reference at sample time, so we
  // keep `current` pointed at the active transaction's trace/span ids.
  #context = this.#defaultContext()
  #state
  #lastSampleCount = 0
  // The agent's `AsyncLocalStorage` instance.
  #store
  // Caches the resolved transaction name; `getFullName()` re-runs the name
  // normalizer while a transaction is in-flight, so avoid it per context change.
  #nameCache = { transaction: null, name: '' }
  // Saved ALS methods, restored by `#unhookContext` on stop.
  #origRun
  #origEnterWith
  // (non-CPED) async hook that refreshes context on async resumption.
  #asyncHook

  constructor({ logger, samplingInterval, tracer, useCPED = true }) {
    super({ logger })
    this.#pprof = require('@datadog/pprof')
    this.#kSampleCount = this.#pprof.time.constants.kSampleCount
    this.#tracer = tracer
    this.#store = tracer._contextManager._asyncLocalStorage
    this.#durationMillis = samplingInterval
    // CPED requires AsyncContextFrame. A caller may force the holder strategy
    // with useCPED: false, but can't force CPED on a runtime that lacks ACF.
    this.#useCPED = useCPED && ASYNC_CONTEXT_FRAME_ACTIVE
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
   * A fresh holder on every call: pprof captures it by reference, so each swap
   * needs its own object or earlier samples would pick up later mutations.
   *
   * @returns {{ current: object }} a new, empty context holder
   */
  #defaultContext() {
    return { current: {} }
  }

  /**
   * (non-CPED) Points the pprof time profiler at a fresh `#context` and resyncs
   * the sample counter.
   */
  #resetContext() {
    this.#context = this.#defaultContext()
    this.#lastSampleCount = this.#state?.[this.#kSampleCount] ?? 0
    this.#pprof.time.setContext(this.#context)
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
    return (this.#useCPED ? captured : captured?.current) ?? {}
  }

  /**
   * Builds the single `span:` label for the active context, or `{}` when there
   * is none. The value is a comma-separated `span_id=…,trace_id=…` string; the
   * ids come from `getLinkingMetadata`, which only returns them when both a
   * segment and transaction are active.
   *
   * @returns {object} the label set (at most one `span:` entry)
   */
  #buildLabel() {
    const { 'trace.id': traceId, 'span.id': spanId } = this.#tracer.agent.getLinkingMetadata(true)
    if (!traceId) {
      return {}
    }

    const ids = [`trace_id=${traceId}`]
    if (spanId) {
      // Should be in span_id, trace_id order
      ids.unshift(`span_id=${spanId}`)
    }
    return { [this.#spanKey(this.#tracer.getTransaction())]: ids.join(',') }
  }

  /**
   * Refreshes the pprof sample context with the active span. With CPED the label
   * is written straight into the current async-context-frame; otherwise a fresh
   * holder is swapped in once a sample has landed (so earlier samples keep their
   * ids) before reassigning its `current`.
   */
  #updateContext = () => {
    if (this.#useCPED) {
      this.#pprof.time.setContext(this.#buildLabel())
      return
    }

    const sampleCount = this.#state?.[this.#kSampleCount]
    if (sampleCount !== this.#lastSampleCount) {
      this.#lastSampleCount = sampleCount
      this.#context = this.#defaultContext()
      this.#pprof.time.setContext(this.#context)
    }

    this.#context.current = this.#buildLabel()
  }

  /**
   * Builds the `span:` label key: the first 16 chars of the trace id plus the
   * transaction name (`span:<traceId[0:16]>:<name>`) to match other language
   * agents' implementation.
   *
   * The backend only cares about the `span:` prefix. Anything after that is just
   * a unique identifier format that other language agents have agreed upon.
   *
   * @param {Transaction} transaction the active transaction
   * @returns {string} the label key
   */
  #spanKey(transaction) {
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
