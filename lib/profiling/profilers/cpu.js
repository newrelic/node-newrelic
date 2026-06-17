/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const BaseProfiler = require('./base')

/**
 * Produces a wall time stack profile via `pprof`.
 * The native sampler fires at a fixed rate against whatever JS is currently
 * on the stack, and the active context is tracked by hooking the agent's
 * `AsyncLocalStorage` (`this.#store`) instance.
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
  // The "context" reference handed to the pprof time profiler. The native
  // sampler captures whatever `current` holds at the moment a sample is taken,
  // so we keep it pointed at the active transaction's trace/span ids.
  #context = this.#defaultContext()
  #state
  #lastSampleCount = 0
  // The agent's `AsyncLocalStorage` instance we use to get the active context.
  #store
  // Caches the resolved transaction name so `getFullName()` (which re-runs the
  // name normalizer while a transaction is in-flight) isn't called on every
  // context change.
  #nameCache = { transaction: null, name: '' }

  constructor({ logger, samplingInterval, tracer }) {
    super({ logger })
    this.#pprof = require('@datadog/pprof')
    this.#kSampleCount = this.#pprof.time.constants.kSampleCount
    this.#tracer = tracer
    this.#store = tracer._contextManager._asyncLocalStorage
    this.#durationMillis = samplingInterval
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
      withContexts: true
    })
    this.#state = this.#pprof.time.getState()
    this.#resetContext()
    this.#hookContext()
  }

  stop() {
    if (!this.#pprof.time.isStarted()) {
      this.logger.trace('CpuProfiler is not started, not stopping.')
      return
    }

    this.#pprof.time.stop(false)
  }

  async collect() {
    const profile = this.#pprof.time.stop(true, this.#linkContext)
    // `stop(true)` restarts sampling, so start a fresh context for the next
    // collection cycle.
    this.#resetContext()
    return this.#pprof.encode(profile)
  }

  /**
   * A fresh pprof context holder. Returns a new object on every call: pprof
   * captures the holder by reference at sample time, so each swap needs its own
   * object or already-captured samples would pick up later mutations.
   *
   * @returns {{ current: object }} a new, empty context holder
   */
  #defaultContext() {
    return { current: {} }
  }

  /**
   * Points the pprof time profiler at a fresh `#context` and resyncs the
   * sample counter.
   */
  #resetContext() {
    this.#context = this.#defaultContext()
    this.#lastSampleCount = this.#state?.[this.#kSampleCount] ?? 0
    this.#pprof.time.setContext(this.#context)
  }

  /**
   * pprof's `generateLabels` callback. For each captured sample context it
   * returns the span label that was active when the sample was taken.
   *
   * @param {object} params params from pprof
   * @param {object} params.context the captured time profile node context
   * @returns {object} label set applied to the pprof sample
   */
  #linkContext = ({ context }) => context?.context?.current ?? {}

  /**
   * Writes the active trace/span ids into `#context.current` as one label: a
   * `span:`-prefixed key and a comma-separated `key=value` value. Uses a fresh
   * `#context` once a new sample has landed, so earlier samples keep their ids.
   */
  #updateContext = () => {
    const sampleCount = this.#state?.[this.#kSampleCount]
    if (sampleCount !== this.#lastSampleCount) {
      this.#lastSampleCount = sampleCount
      this.#context = this.#defaultContext()
      this.#pprof.time.setContext(this.#context)
    }

    // Only returns ids when both a segment and transaction are active.
    const { 'trace.id': traceId, 'span.id': spanId } = this.#tracer.agent.getLinkingMetadata(true)

    // Assign span_id + trace_id label
    if (traceId) {
      const ids = [`trace_id=${traceId}`]
      if (spanId) {
        // Should be in span_id, trace_id order
        ids.unshift(`span_id=${spanId}`)
      }
      // Reassign `current` every run() between two samples, because a
      // sample must reflect only the span active when it was taken, not
      // every span seen this sample window.
      this.#context.current = { [this.#spanKey(this.#tracer.getTransaction())]: ids.join(',') }
    } else {
      this.#context.current = {}
    }
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
   * Wraps `run` on the agent's single `AsyncLocalStorage` so the pprof holder
   * is refreshed on every context switch: on `run` entry (the agent propagates
   * all transaction context through this one instance) and on `run` exit (so a
   * sibling doesn't inherit a returned child's span). It wraps the instance,
   * not the prototype, leaves other libraries' ALS untouched.
   *
   * @todo On Node 24+ (AsyncContextFrame is on by default), pprof's `useCPED: true`
   * carries context per-frame and would remove this hook, the `wrapped` frame
   * in the flame graph UI, and the manual #context.current updates.
   */
  #hookContext() {
    const self = this
    const origRun = this.#store.run
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
}

module.exports = CpuProfiler
