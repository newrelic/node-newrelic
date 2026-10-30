/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const EventEmitter = require('node:events')
const { PerformanceObserver, constants } = require('node:perf_hooks')

/**
 * Maps the numeric GC type identifiers to the metric-friendly names the agent
 * emits. The numeric keys mirror the identifiers historically produced by the
 * native `@newrelic/native-metrics` module so that the metric names this module
 * records (e.g. `GC/Scavenge`) remain identical.
 *
 * `perf_hooks` reports each collection's type via the `detail.kind` constants
 * (`NODE_PERFORMANCE_GC_*`), which map one-to-one onto these identifiers. `All`
 * (31) is a synthetic aggregate across every collection and has no `perf_hooks`
 * equivalent; it is produced internally.
 */
const GC_TYPE_NAMES = {
  [constants.NODE_PERFORMANCE_GC_MINOR]: 'Scavenge', // 1
  [constants.NODE_PERFORMANCE_GC_MAJOR]: 'MarkSweepCompact', // 4
  [constants.NODE_PERFORMANCE_GC_INCREMENTAL]: 'IncrementalMarking', // 8
  [constants.NODE_PERFORMANCE_GC_WEAKCB]: 'ProcessWeakCallbacks' // 16
}
const GC_TYPE_ALL = 31

/**
 * Accumulates a bundle of values from repeated garbage collection measurements.
 */
class Metric {
  constructor() {
    this.reset()
  }

  /**
   * Folds a single measured value into the running aggregate.
   *
   * @param {number} value The value to accumulate.
   */
  add(value) {
    if (this.count === 0) {
      this.min = this.max = value
    } else {
      this.min = Math.min(this.min, value)
      this.max = Math.max(this.max, value)
    }
    this.total += value
    this.sumOfSquares += value * value
    this.count += 1
  }

  /**
   * Resets the aggregate back to its empty state.
   */
  reset() {
    this.total = 0
    this.min = 0
    this.max = 0
    this.sumOfSquares = 0
    this.count = 0
  }
}

/**
 * Collects virtual machine metrics (garbage collection pause times and
 * per-tick event loop CPU usage) using only Node.js standard library APIs.
 *
 * This is a pure-JavaScript drop-in replacement for the optional
 * `@newrelic/native-metrics` native addon. It intentionally preserves that
 * module's public surface — `bound`, `gcEnabled`, `loopEnabled`, `bind`,
 * `unbind`, `getGCMetrics`, and `getLoopMetrics` — so the system metrics
 * sampler can consume it without changes.
 */
class VMMetricsEmitter extends EventEmitter {
  // GC collection state.
  #gcMetrics = Object.create(null)
  #gcObserver

  // Loop collection state. `#loopUsage` accumulates the per-tick
  // `process.cpuUsage` deltas (in microseconds), matching the units the native
  // module reported.
  #loopUsage = new Metric()
  #lastCpuUsage = null
  #loopSampler = null

  constructor() {
    super()

    this.bound = false

    // GC and loop collection use only standard library APIs, so they are
    // always available on supported Node.js versions.
    this.gcEnabled = true
    this.loopEnabled = true

    this.#gcObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.#recordGC(entry)
      }
    })
  }

  /**
   * Records a single garbage collection entry from the performance observer.
   * The entry's `duration` is already expressed in milliseconds, matching the
   * unit the native module reported. Every collection is additionally folded
   * into the synthetic `All` aggregate.
   *
   * @param {PerformanceEntry} entry A `gc` performance entry.
   */
  #recordGC(entry) {
    const kind = entry.detail && entry.detail.kind
    const duration = entry.duration

    if (GC_TYPE_NAMES[kind]) {
      const metric = this.#gcMetrics[kind] || (this.#gcMetrics[kind] = new Metric())
      metric.add(duration)
    }

    const all = this.#gcMetrics[GC_TYPE_ALL] || (this.#gcMetrics[GC_TYPE_ALL] = new Metric())
    all.add(duration)
  }

  /**
   * Samples the process CPU usage consumed since the previous tick and folds
   * the delta into the loop usage aggregate. Runs once per event loop
   * iteration while bound.
   */
  #sampleLoop() {
    const usage = process.cpuUsage()
    if (this.#lastCpuUsage) {
      const delta = (usage.user - this.#lastCpuUsage.user) +
        (usage.system - this.#lastCpuUsage.system)
      this.#loopUsage.add(delta)
    }
    this.#lastCpuUsage = usage

    if (this.bound) {
      // Reschedule for the next loop iteration without keeping the process
      // alive, mirroring the native module's unref'd libuv check handle.
      this.#loopSampler = setImmediate(() => this.#sampleLoop())
      this.#loopSampler.unref()
    }
  }

  /**
   * Binds into the GC performance observer and the per-tick loop sampler to
   * begin populating data.
   */
  bind() {
    if (this.bound) {
      return
    }

    this.#gcObserver.observe({ type: 'gc' })

    this.#lastCpuUsage = process.cpuUsage()
    this.bound = true
    this.#loopSampler = setImmediate(() => this.#sampleLoop())
    this.#loopSampler.unref()
  }

  /**
   * Removes the GC observer and stops the loop sampler.
   */
  unbind() {
    if (!this.bound) {
      return
    }

    this.bound = false
    this.#gcObserver.disconnect()

    if (this.#loopSampler) {
      clearImmediate(this.#loopSampler)
      this.#loopSampler = null
    }
    this.#lastCpuUsage = null
  }

  /**
   * Retrieves the current loop metrics and resets the counters. Values are in
   * microseconds.
   *
   * @returns {object} An object with a `usage` metric.
   */
  getLoopMetrics() {
    const usage = {
      total: this.#loopUsage.total,
      min: this.#loopUsage.min,
      max: this.#loopUsage.max,
      sumOfSquares: this.#loopUsage.sumOfSquares,
      count: this.#loopUsage.count
    }
    this.#loopUsage.reset()
    return { usage }
  }

  /**
   * Retrieves the accumulated garbage collection metrics and resets them. Only
   * GC types that have occurred at least once since the last retrieval are
   * returned. Durations are in milliseconds.
   *
   * @returns {object} An object mapping GC type names to information about the
   * GC events that occurred.
   */
  getGCMetrics() {
    const results = Object.create(null)
    for (const typeId of Object.keys(this.#gcMetrics)) {
      const metric = this.#gcMetrics[typeId]
      if (metric.count === 0) {
        continue
      }

      const numericTypeId = parseInt(typeId, 10)
      const typeName = numericTypeId === GC_TYPE_ALL ? 'All' : GC_TYPE_NAMES[numericTypeId]
      results[typeName] = {
        typeId: numericTypeId,
        type: typeName,
        metrics: {
          total: metric.total,
          min: metric.min,
          max: metric.max,
          sumOfSquares: metric.sumOfSquares,
          count: metric.count
        }
      }
      metric.reset()
    }

    return results
  }
}

let emitter = null

/**
 * Retrieves the {@link VMMetricsEmitter} singleton instance. The sampling
 * cadence is controlled by the caller (the system metrics sampler), so no
 * options are required here.
 *
 * @returns {VMMetricsEmitter} The singleton emitter.
 */
module.exports = function getMetricEmitter() {
  if (!emitter) {
    emitter = new VMMetricsEmitter()
  }
  return emitter
}

module.exports.VMMetricsEmitter = VMMetricsEmitter
module.exports.Metric = Metric
