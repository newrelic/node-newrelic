/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const os = require('node:os')
const logger = require('../logger.js').child({
  component: 'system-metrics-sampler'
})
const Timer = require('../timer.js')

const NAMES = require('../metrics/names.js')
const VMMetricsCollector = require('./vm-metrics-collector.js')

const MILLIS = 1e3
const MICROS = 1e6
const CPUS = os.cpus().length
const SAMPLE_INTERVAL = 15 * MILLIS

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

function recordQueueTime(agent, timer) {
  timer.end()
  agent.metrics.measureMilliseconds(NAMES.EVENTS.WAIT, null, timer.getDurationInMillis())
}

function sampleMemory(agent) {
  return function memorySampler() {
    try {
      const mem = process.memoryUsage()
      agent.metrics.measureBytes(NAMES.MEMORY.PHYSICAL, mem.rss)
      agent.metrics.measureBytes(NAMES.MEMORY.USED_HEAP, mem.heapUsed)
      agent.metrics.measureBytes(NAMES.MEMORY.MAX_HEAP, mem.heapTotal)
      agent.metrics.measureBytes(NAMES.MEMORY.FREE_HEAP, mem.heapTotal - mem.heapUsed)
      agent.metrics.measureBytes(NAMES.MEMORY.USED_NONHEAP, mem.rss - mem.heapTotal)
      logger.trace(mem, 'Recorded memory')
    } catch (e) {
      logger.debug('Could not record memory usage', e)
    }
  }
}

function checkEvents(agent) {
  return function eventSampler() {
    const timer = new Timer()
    timer.begin()
    setTimeout(recordQueueTime.bind(null, agent, timer), 0)
  }
}

function getCpuSample(lastSample) {
  try {
    return process.cpuUsage(lastSample)
  } catch (e) {
    logger.debug('Could not record cpu usage', e)
    return null
  }
}

function generateCPUMetricRecorder(agent) {
  let lastSampleTime
  // userTime and sysTime are in seconds
  return function recordCPUMetrics(userTime, sysTime) {
    let elapsedUptime
    if (!lastSampleTime) {
      elapsedUptime = process.uptime()
    } else {
      elapsedUptime = (Date.now() - lastSampleTime) / MILLIS
    }

    const totalCpuTime = CPUS * elapsedUptime

    lastSampleTime = Date.now()

    const userUtil = userTime / totalCpuTime
    const sysUtil = sysTime / totalCpuTime

    recordValue(agent, NAMES.CPU.USER_TIME, userTime)
    recordValue(agent, NAMES.CPU.SYSTEM_TIME, sysTime)
    recordValue(agent, NAMES.CPU.USER_UTILIZATION, userUtil)
    recordValue(agent, NAMES.CPU.SYSTEM_UTILIZATION, sysUtil)
  }
}

function sampleCpu(agent) {
  let lastSample
  const recordCPU = generateCPUMetricRecorder(agent)
  return function cpuSampler() {
    const cpuSample = getCpuSample(lastSample)
    lastSample = getCpuSample()

    if (lastSample == null) {
      return
    }

    recordCPU(cpuSample.user / MICROS, cpuSample.system / MICROS)
  }
}

function sampleLoop(agent, vmMetrics) {
  return function loopSampler() {
    // Convert from microseconds to seconds
    const loopMetrics = vmMetrics.getLoopMetrics()
    divideMetric(loopMetrics.usage, MICROS)

    recordCompleteMetric(agent, NAMES.LOOP.USAGE, loopMetrics.usage)
  }
}

function sampleGc(agent, vmMetrics) {
  return function gcSampler() {
    const gcMetrics = vmMetrics.getGCMetrics()

    for (const gcType of Object.keys(gcMetrics)) {
      // Convert from milliseconds to seconds.
      const gc = gcMetrics[gcType]
      divideMetric(gc.metrics, MILLIS)

      recordCompleteMetric(agent, NAMES.GC.PAUSE_TIME, gc.metrics)
      if (gc.type) {
        recordCompleteMetric(agent, NAMES.GC.PREFIX + gc.type, gc.metrics)
      } else {
        logger.debug(gc, 'Unknown GC type %j', gc.typeId)
      }
    }
  }
}

/**
 * Samples host and runtime metrics (memory, CPU, event queue depth, GC pauses,
 * and event loop CPU usage) on a recurring interval and records them on the
 * agent's metric aggregator.
 */
class SystemMetricsSampler {
  state = 'stopped'
  vmMetrics = null

  #samplers = []

  // Exposed as instance methods so individual samplers can be exercised in
  // isolation (see the unit tests); they remain pure factories.
  sampleMemory = sampleMemory
  checkEvents = checkEvents
  sampleCpu = sampleCpu
  sampleGc = sampleGc
  sampleLoop = sampleLoop

  start(agent) {
    this.#samplers.push(new IntervalHandle(sampleMemory(agent), 5 * MILLIS))
    this.#samplers.push(new IntervalHandle(checkEvents(agent), SAMPLE_INTERVAL))

    // VM metrics (GC pauses and event loop CPU usage) are collected via a
    // pure-JavaScript module built on the Node.js standard library, so unlike
    // the former native addon it is always available on supported runtimes.
    if (agent.config.plugins.native_metrics.enabled && !this.vmMetrics) {
      this.vmMetrics = new VMMetricsCollector()
    }

    if (this.vmMetrics) {
      if (!this.vmMetrics.bound) {
        this.vmMetrics.bind(SAMPLE_INTERVAL)
      }

      this.#samplers.push(new IntervalHandle(sampleGc(agent, this.vmMetrics), SAMPLE_INTERVAL))
      this.#samplers.push(new IntervalHandle(sampleLoop(agent, this.vmMetrics), SAMPLE_INTERVAL))
    }

    // Add CPU sampling using the built-in data (introduced in 6.1.0)
    this.#samplers.push(new IntervalHandle(sampleCpu(agent), SAMPLE_INTERVAL))

    this.state = 'running'
  }

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

module.exports = SystemMetricsSampler

function recordValue(agent, metric, value) {
  const stats = agent.metrics.getOrCreateMetric(metric)
  stats.recordValue(value)
  logger.trace('Recorded metric %s: %j', metric, value)
}

function recordCompleteMetric(agent, metricName, metric) {
  const stats = agent.metrics.getOrCreateMetric(metricName)
  stats.merge(metric)
  logger.trace('Recorded metric %s: %j', metricName, metric)
}

function divideMetric(metric, divisor) {
  metric.min /= divisor
  metric.max /= divisor
  metric.total /= divisor
  metric.sumOfSquares /= divisor * divisor
}
