/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const os = require('node:os')
const defaultLogger = require('../logger.js').child({
  component: 'system-metrics-sampler'
})
const Timer = require('../timer.js')

const NAMES = require('../metrics/names.js')
const VMMetricsCollector = require('./vm-metrics-collector.js')

const MILLIS = 1e3
const MICROS = 1e6
const CPUS = os.cpus().length
const SAMPLE_INTERVAL = 15 * MILLIS
const MEMORY_SAMPLE_INTERVAL = 5 * MILLIS

/**
 * Wraps an unref'd recurring timer so a sampler can be stopped individually.
 */
class IntervalHandle {
  constructor(sampler, interval) {
    this.id = setInterval(sampler, interval)
    this.id.unref()
  }

  stop() {
    clearInterval(this.id)
  }
}

/**
 * Samples host and runtime metrics (memory, CPU, event queue depth, GC pauses,
 * and event loop CPU usage) on a recurring interval and records them on the
 * agent's metric aggregator.
 */
class Sampler {
  state = 'stopped'
  vmMetrics = null

  #agent
  #logger
  #interval
  #memoryInterval
  #samplers = []

  // Per-sampler state that must persist across ticks.
  #lastCpuSample = null
  #lastCpuSampleTime = null

  /**
   * @param {object} [params] Sampler params.
   * @param {object} [params.agent] The agent whose metric aggregator receives
   * samples.
   * @param {object} [params.logger] The logger to use.
   * @param {number} [params.interval] The sampling interval, in milliseconds,
   * for CPU, event queue, GC, and loop metrics.
   * @param {number} [params.memoryInterval] The sampling interval, in
   * milliseconds, for memory metrics. Defaults to `params.interval` when that
   * is provided, otherwise to a five-second cadence.
   */
  constructor({
    agent,
    logger = defaultLogger,
    interval = SAMPLE_INTERVAL,
    memoryInterval
  } = {}) {
    this.#agent = agent
    this.#logger = logger
    this.#interval = interval
    this.#memoryInterval = memoryInterval ?? (
      interval === SAMPLE_INTERVAL
        ? MEMORY_SAMPLE_INTERVAL
        : interval
    )
  }

  #checkEvents() {
    const agent = this.#agent
    const timer = new Timer()
    timer.begin()
    setTimeout(
      () => {
        timer.end()
        agent.metrics.measureMilliseconds(
          NAMES.EVENTS.WAIT,
          null,
          timer.getDurationInMillis()
        )
      },
      0
    )
  }

  #divideMetric(metric, divisor) {
    metric.min /= divisor
    metric.max /= divisor
    metric.total /= divisor
    metric.sumOfSquares /= divisor * divisor
  }

  #getCpuSample(lastSample) {
    try {
      return process.cpuUsage(lastSample)
    } catch (e) {
      this.#logger.debug('Could not record cpu usage', e)
      return null
    }
  }

  #recordCompleteMetric(metricName, metric) {
    const stats = this.#agent.metrics.getOrCreateMetric(metricName)
    stats.merge(metric)
    this.#logger.trace('Recorded metric %s: %j', metricName, metric)
  }

  #recordValue(metric, value) {
    const stats = this.#agent.metrics.getOrCreateMetric(metric)
    stats.recordValue(value)
    this.#logger.trace('Recorded metric %s: %j', metric, value)
  }

  #sampleCpu() {
    const cpuSample = this.#getCpuSample(this.#lastCpuSample)
    this.#lastCpuSample = this.#getCpuSample()

    if (this.#lastCpuSample == null) {
      return
    }

    // userTime and sysTime are in seconds.
    const userTime = cpuSample.user / MICROS
    const sysTime = cpuSample.system / MICROS

    let elapsedUptime
    if (!this.#lastCpuSampleTime) {
      elapsedUptime = process.uptime()
    } else {
      elapsedUptime = (Date.now() - this.#lastCpuSampleTime) / MILLIS
    }

    const totalCpuTime = CPUS * elapsedUptime

    this.#lastCpuSampleTime = Date.now()

    const userUtil = userTime / totalCpuTime
    const sysUtil = sysTime / totalCpuTime

    this.#recordValue(NAMES.CPU.USER_TIME, userTime)
    this.#recordValue(NAMES.CPU.SYSTEM_TIME, sysTime)
    this.#recordValue(NAMES.CPU.USER_UTILIZATION, userUtil)
    this.#recordValue(NAMES.CPU.SYSTEM_UTILIZATION, sysUtil)
  }

  #sampleGc() {
    const gcMetrics = this.vmMetrics.getGCMetrics()

    for (const gcType of Object.keys(gcMetrics)) {
      // Convert from milliseconds to seconds.
      const gc = gcMetrics[gcType]
      this.#divideMetric(gc.metrics, MILLIS)

      this.#recordCompleteMetric(NAMES.GC.PAUSE_TIME, gc.metrics)
      if (gc.type) {
        this.#recordCompleteMetric(NAMES.GC.PREFIX + gc.type, gc.metrics)
      } else {
        this.#logger.debug(gc, 'Unknown GC type %j', gc.typeId)
      }
    }
  }

  #sampleLoop() {
    // Convert from microseconds to seconds.
    const loopMetrics = this.vmMetrics.getLoopMetrics()
    this.#divideMetric(loopMetrics.usage, MICROS)

    this.#recordCompleteMetric(NAMES.LOOP.USAGE, loopMetrics.usage)
  }

  #sampleMemory() {
    try {
      const mem = process.memoryUsage()
      const metrics = this.#agent.metrics
      metrics.measureBytes(NAMES.MEMORY.PHYSICAL, mem.rss)
      metrics.measureBytes(NAMES.MEMORY.USED_HEAP, mem.heapUsed)
      metrics.measureBytes(NAMES.MEMORY.MAX_HEAP, mem.heapTotal)
      metrics.measureBytes(NAMES.MEMORY.FREE_HEAP, mem.heapTotal - mem.heapUsed)
      metrics.measureBytes(NAMES.MEMORY.USED_NONHEAP, mem.rss - mem.heapTotal)
      this.#logger.trace(mem, 'Recorded memory')
    } catch (e) {
      this.#logger.debug('Could not record memory usage', e)
    }
  }

  /**
   * Begins sampling and recording metrics on the configured agent.
   */
  start() {
    this.#samplers.push(
      new IntervalHandle(() => this.#sampleMemory(), this.#memoryInterval)
    )
    this.#samplers.push(
      new IntervalHandle(() => this.#checkEvents(), this.#interval)
    )

    // VM metrics (GC pauses and event loop CPU usage) are collected via a
    // pure-JavaScript module built on the Node.js standard library, so unlike
    // the former native addon it is always available on supported runtimes.
    if (this.#agent.config.isNativeMetricsEnabled() && !this.vmMetrics) {
      this.vmMetrics = new VMMetricsCollector()
    }

    if (this.vmMetrics) {
      if (!this.vmMetrics.bound) {
        this.vmMetrics.bind(this.#interval)
      }

      this.#samplers.push(
        new IntervalHandle(() => this.#sampleGc(), this.#interval)
      )
      this.#samplers.push(
        new IntervalHandle(() => this.#sampleLoop(), this.#interval)
      )
    }

    // Add CPU sampling using the built-in data (introduced in 6.1.0)
    this.#lastCpuSample = null
    this.#lastCpuSampleTime = null
    this.#samplers.push(
      new IntervalHandle(() => this.#sampleCpu(), this.#interval)
    )

    this.state = 'running'
  }

  /**
   * Stops all sampling and releases the VM metrics collector.
   */
  stop() {
    for (const sampler of this.#samplers) {
      sampler.stop()
    }
    this.#samplers = []
    this.state = 'stopped'
    if (this.vmMetrics) {
      this.vmMetrics.unbind()

      // Setting this.vmMetrics to null allows us to config a new vmMetrics
      // object after the first start call.
      this.vmMetrics = null
    }
  }
}

module.exports = Sampler
