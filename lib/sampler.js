'use strict'

var NAMES = require('./metrics/names')
var logger = require('./logger').child({component: 'sampler'})
var Timer = require('./timer')
var os = require('os')

/*
 *
 * CONSTANTS
 *
 */
var MILLIS = 1e3
var MICROS = 1e6
var CPUS = os.cpus().length
var SAMPLE_INTERVAL = 15 * MILLIS

var samplers = []

function Sampler(sampler, interval) {
  this.id = setInterval(sampler, interval)
  this.id.unref()
}

Sampler.prototype.stop = function stop() {
  clearInterval(this.id)
}

function recordQueueTime(agent, timer) {
  timer.end()
  agent.metrics.measureMilliseconds(NAMES.EVENTS.WAIT, null, timer.getDurationInMillis())
}

function sampleMemory(agent) {
  return function memorySampler() {
    try {
      var mem = process.memoryUsage()
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
    var timer = new Timer()
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
  var lastSampleTime
  // userTime and sysTime are in seconds
  return function recordCPUMetrics(userTime, sysTime) {
    var elapsedUptime
    if (!lastSampleTime) {
      elapsedUptime = process.uptime()
    } else {
      elapsedUptime = (Date.now() - lastSampleTime) / MILLIS
    }

    var totalCpuTime = CPUS * elapsedUptime

    lastSampleTime = Date.now()

    var userUtil = userTime / totalCpuTime
    var sysUtil  = sysTime / totalCpuTime

    recordValue(agent, NAMES.CPU.USER_TIME, userTime)
    recordValue(agent, NAMES.CPU.SYSTEM_TIME, sysTime)
    recordValue(agent, NAMES.CPU.USER_UTILIZATION, userUtil)
    recordValue(agent, NAMES.CPU.SYSTEM_UTILIZATION, sysUtil)
  }
}

function sampleCpu(agent) {
  var lastSample
  var recordCPU = generateCPUMetricRecorder(agent)
  return function cpuSampler() {
    var cpuSample = getCpuSample(lastSample)
    lastSample = getCpuSample()

    if (lastSample == null) {
      return
    }

    recordCPU(cpuSample.user / MICROS, cpuSample.system / MICROS)
  }
}

function sampleCpuNative(agent, nativeMetrics) {
  var recordCPU = generateCPUMetricRecorder(agent)
  nativeMetrics.on('usage', function collectResourceUsage(usage) {
    recordCPU(usage.diff.ru_utime / MILLIS, usage.diff.ru_stime / MILLIS)
  })

  return function cpuSampler() {
    // NOOP?
  }
}

function sampleLoop(agent, nativeMetrics) {
  return function loopSampler() {
    // Convert from microseconds to seconds
    const loopMetrics = nativeMetrics.getLoopMetrics()
    divideMetric(loopMetrics.usage, MICROS)

    recordCompleteMetric(agent, NAMES.LOOP.USAGE, loopMetrics.usage)
  }
}

function sampleGc(agent, nativeMetrics) {
  return function gcSampler() {
    const gcMetrics = nativeMetrics.getGCMetrics()

    Object.keys(gcMetrics).forEach(function forEachGCType(gcType) {
      // Convert from milliseconds to seconds.
      const gc = gcMetrics[gcType]
      divideMetric(gc.metrics, MILLIS)

      recordCompleteMetric(agent, NAMES.GC.PAUSE_TIME, gc.metrics)
      if (gc.type) {
        recordCompleteMetric(agent, NAMES.GC.PREFIX + gc.type, gc.metrics)
      } else {
        logger.debug(gc, 'Unknown GC type %j', gc.typeId)
      }
    })
  }
}

var sampler = module.exports = {
  state: 'stopped',
  sampleMemory: sampleMemory,
  checkEvents: checkEvents,
  sampleCpu: sampleCpu,
  sampleGc: sampleGc,
  sampleLoop: sampleLoop,
  nativeMetrics: null,

  start: function start(agent) {
    samplers.push(new Sampler(sampleMemory(agent), 5 * MILLIS))
    samplers.push(new Sampler(checkEvents(agent), SAMPLE_INTERVAL))

    // This requires a native module which may have failed to build.
    if (agent.config.plugins.native_metrics.enabled && !this.nativeMetrics) {
      try {
        this.nativeMetrics = require('@newrelic/native-metrics')({
          timeout: SAMPLE_INTERVAL
        })
      } catch (err) {
        logger.info(
          {error: {message: err.message, stack: err.stack}},
          'Not adding native metric sampler.'
        )
        agent.metrics.getOrCreateMetric(
          NAMES.SUPPORTABILITY.DEPENDENCIES + '/NoNativeMetricsModule'
        ).incrementCallCount()
      }
    }

    if (this.nativeMetrics) {
      if (!this.nativeMetrics.bound) {
        this.nativeMetrics.bind(SAMPLE_INTERVAL)
      }

      // Add GC events if available.
      if (this.nativeMetrics.gcEnabled) {
        samplers.push(new Sampler(sampleGc(agent, this.nativeMetrics), SAMPLE_INTERVAL))
      }

      // Add loop metrics if available.
      if (this.nativeMetrics.loopEnabled) {
        samplers.push(new Sampler(sampleLoop(agent, this.nativeMetrics), SAMPLE_INTERVAL))
      }
    }

    // Add CPU sampling using the built-in data if available, otherwise pulling
    // from the native module.
    if (process.cpuUsage) { // introduced in 6.1.0
      samplers.push(new Sampler(sampleCpu(agent), SAMPLE_INTERVAL))
    } else if (this.nativeMetrics && this.nativeMetrics.usageEnabled) {
      samplers.push(
        new Sampler(sampleCpuNative(agent, this.nativeMetrics), SAMPLE_INTERVAL)
      )
    } else {
      logger.debug('Not adding CPU metric sampler.')
    }

    sampler.state = 'running'
  },

  stop: function stop() {
    samplers.forEach(function forEachSampler(s) {
      s.stop()
    })
    samplers = []
    sampler.state = 'stopped'
    if (this.nativeMetrics) {
      this.nativeMetrics.unbind()
      this.nativeMetrics.removeAllListeners()

      // Setting this.nativeMetrics to null allows us to config a new
      // nativeMetrics object after the first start call.
      this.nativeMetrics = null
    }
  }
}

function recordValue(agent, metric, value) {
  var stats = agent.metrics.getOrCreateMetric(metric)
  stats.recordValue(value)
  logger.trace('Recorded metric %s: %j', metric, value)
}

function recordCompleteMetric(agent, metricName, metric) {
  var stats = agent.metrics.getOrCreateMetric(metricName)
  stats.merge(metric)
  logger.trace('Recorded metric %s: %j', metricName, metric)
}

function divideMetric(metric, divisor) {
  metric.min /= divisor
  metric.max /= divisor
  metric.total /= divisor
  metric.sumOfSquares /= (divisor * divisor)
}
