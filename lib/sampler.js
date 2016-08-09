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

var samplers = []

function Sampler(sampler, interval) {
  this.id = setInterval(sampler, interval)
  // timer.unref only in 0.9+
  if (this.id.unref) this.id.unref()
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
      logger.trace('Recorded memory:', mem)
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

function sampleCpu(agent) {
  var lastSample
  var lastSampleTime
  return function cpuSampler() {
    var cpuSample = getCpuSample(lastSample)
    lastSample = getCpuSample()

    if (lastSample == null) {
      return
    }
    
    var elapsedUptime
    if (!lastSampleTime) {
      elapsedUptime = process.uptime()
    } else {
      elapsedUptime = (Date.now() - lastSampleTime) / MILLIS
    }

    var userTime = cpuSample.user / MICROS
    var sysTime = cpuSample.system / MICROS

    var totalCpuTime = CPUS * elapsedUptime

    var userUtil = userTime / totalCpuTime
    var sysUtil  = sysTime / totalCpuTime

    var metrics = [
      [NAMES.CPU.USER_TIME, userTime],
      [NAMES.CPU.SYSTEM_TIME, sysTime],
      [NAMES.CPU.USER_UTILIZATION, userUtil],
      [NAMES.CPU.SYSTEM_UTILIZATION, sysUtil]
    ]

    for (var i = 0; i < metrics.length; i++) {
      var name = metrics[i][0]
      var sample = metrics[i][1]

      var stats = agent.metrics.getOrCreateMetric(name)
      stats.recordValue(sample)
      logger.trace('Recorded CPU metric %s:', name, sample)
    }
  }
}

var sampler = module.exports = {
  state: 'stopped',
  sampleMemory: sampleMemory,
  checkEvents: checkEvents,
  sampleCpu: sampleCpu,

  start: function start(agent) {
    samplers.push(new Sampler(sampleMemory(agent), 5 * MILLIS))
    samplers.push(new Sampler(checkEvents(agent), 15 * MILLIS))

    if (process.cpuUsage) { // introduced in 6.1.0
      samplers.push(new Sampler(sampleCpu(agent), 60 * MILLIS))
    }

    sampler.state = 'running'
  },

  stop: function stop() {
    samplers.forEach(function cb_forEach(sampler) {
      sampler.stop()
    })
    samplers = []
    sampler.state = 'stopped'
  }
}
