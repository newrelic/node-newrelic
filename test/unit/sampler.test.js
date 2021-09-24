/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const Agent = require('../../lib/agent')
const configurator = require('../../lib/config')
const expect = require('chai').expect
const sampler = require('../../lib/sampler')

const NAMES = require('../../lib/metrics/names')

describe('environmental sampler', function () {
  let agent = null
  const numCpus = require('os').cpus().length
  const oldCpuUsage = process.cpuUsage
  const oldUptime = process.uptime

  beforeEach(function () {
    agent = new Agent(configurator.initialize())
    process.cpuUsage = function () {
      // process.cpuUsage return values in cpu microseconds (1^-6)
      return { user: 1e6 * numCpus, system: 1e6 * numCpus }
    }
    process.uptime = function () {
      // process.uptime returns values in seconds
      return 1
    }
  })

  afterEach(function () {
    sampler.stop()
    process.cpuUsage = oldCpuUsage
    process.uptime = oldUptime
  })

  it('should have the native-metrics package available', function () {
    expect(function () {
      require('@newrelic/native-metrics')
    }).to.not.throw()
  })

  it('should still gather native metrics when bound and unbound', function (done) {
    sampler.start(agent)
    sampler.stop()
    sampler.start(agent)

    // Clear up the current state of the metrics.
    sampler.nativeMetrics.getGCMetrics()
    sampler.nativeMetrics.getLoopMetrics()

    spinLoop(function runLoop() {
      sampler.sampleLoop(agent, sampler.nativeMetrics)()
      sampler.sampleGc(agent, sampler.nativeMetrics)()

      const loop = agent.metrics.getOrCreateMetric(NAMES.LOOP.USAGE)
      expect(loop.callCount).to.be.above(1)
      expect(loop.max).to.be.above(0)
      expect(loop.min).to.be.at.most(loop.max)
      expect(loop.total).to.be.at.least(loop.max)

      // Find at least one typed GC metric.
      const type = [
        'Scavenge',
        'MarkSweepCompact',
        'IncrementalMarking',
        'ProcessWeakCallbacks',
        'All'
      ].find((t) => agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + t).callCount)
      expect(type).to.exist

      const gc = agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + type)
      expect(gc).property('callCount').to.be.at.least(1)
      expect(gc).property('total').to.be.at.least(0.001) // At least 1 ms of GC

      const pause = agent.metrics.getOrCreateMetric(NAMES.GC.PAUSE_TIME)
      expect(pause).property('callCount').to.be.at.least(gc.callCount)
      expect(pause).property('total').to.be.at.least(gc.total)

      done()
    })
  })

  it('should gather loop metrics', function (done) {
    sampler.start(agent)
    sampler.nativeMetrics.getLoopMetrics()
    spinLoop(function runLoop() {
      sampler.sampleLoop(agent, sampler.nativeMetrics)()

      const stats = agent.metrics.getOrCreateMetric(NAMES.LOOP.USAGE)
      expect(stats.callCount).to.be.above(1)
      expect(stats.max).to.be.above(0)
      expect(stats.min).to.be.at.most(stats.max)
      expect(stats.total).to.be.at.least(stats.max)
      done()
    })
  })

  it('should depend on Agent to provide the current metrics summary', function () {
    expect(function () {
      sampler.start(agent)
    }).to.not.throw()
    expect(function () {
      sampler.stop(agent)
    }).to.not.throw()
  })

  it('should default to a state of stopped', function () {
    expect(sampler.state).equal('stopped')
  })

  it('should say it is running after start', function () {
    sampler.start(agent)
    expect(sampler.state).equal('running')
  })

  it('should say it is stopped after stop', function () {
    sampler.start(agent)
    expect(sampler.state).equal('running')
    sampler.stop(agent)
    expect(sampler.state).equal('stopped')
  })

  it('should gather CPU user utilization metric', function () {
    sampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.USER_UTILIZATION)
    expect(stats.callCount).equal(1)
    expect(stats.total).equal(1)
  })

  it('should gather CPU system utilization metric', function () {
    sampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.SYSTEM_UTILIZATION)
    expect(stats.callCount).equal(1)
    expect(stats.total).equal(1)
  })

  it('should gather CPU user time metric', function () {
    sampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.USER_TIME)
    expect(stats.callCount).equal(1)
    expect(stats.total).equal(numCpus)
  })

  it('should gather CPU sytem time metric', function () {
    sampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.SYSTEM_TIME)
    expect(stats.callCount).equal(1)
    expect(stats.total).equal(numCpus)
  })

  it('should gather GC metrics', function (done) {
    sampler.start(agent)

    // Clear up the current state of the metrics.
    sampler.nativeMetrics.getGCMetrics()

    spinLoop(function runLoop() {
      sampler.sampleGc(agent, sampler.nativeMetrics)()

      // Find at least one typed GC metric.
      const type = [
        'Scavenge',
        'MarkSweepCompact',
        'IncrementalMarking',
        'ProcessWeakCallbacks',
        'All'
      ].find((t) => agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + t).callCount)
      expect(type).to.exist

      const gc = agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + type)
      expect(gc).property('callCount').to.be.at.least(1)

      // Assuming GC to take some amount of time.
      // With Node 12, the minimum for this work often seems to be
      // around 0.0008 on the servers.
      expect(gc).property('total').to.be.at.least(0.0005)

      const pause = agent.metrics.getOrCreateMetric(NAMES.GC.PAUSE_TIME)
      expect(pause).property('callCount').to.be.at.least(gc.callCount)
      expect(pause).property('total').to.be.at.least(gc.total)

      done()
    })
  })

  it('should not gather GC metrics if disabled', function () {
    agent.config.plugins.native_metrics.enabled = false
    sampler.start(agent)
    expect(sampler.nativeMetrics).to.be.null
  })

  it('should catch if process.cpuUsage throws an error', function () {
    process.cpuUsage = function () {
      throw new Error('ohhhhhh boyyyyyy')
    }
    sampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric('CPU/User/Utilization')
    expect(stats.callCount).equal(0)
  })

  it('should collect all specified memory statistics', function () {
    sampler.sampleMemory(agent)()

    Object.keys(NAMES.MEMORY).forEach(function testStat(memoryStat) {
      const metricName = NAMES.MEMORY[memoryStat]
      const stats = agent.metrics.getOrCreateMetric(metricName)
      expect(stats.callCount, `${metricName} callCount`).to.equal(1)
      expect(stats.max, `${metricName} max`).to.be.above(1)
    })
  })

  it('should catch if process.memoryUsage throws an error', function () {
    const oldProcessMem = process.memoryUsage
    process.memoryUsage = function () {
      throw new Error('your computer is on fire')
    }
    sampler.sampleMemory(agent)()

    const stats = agent.metrics.getOrCreateMetric('Memory/Physical')
    expect(stats.callCount).equal(0)
    process.memoryUsage = oldProcessMem
  })

  it('should have some rough idea of how deep the event queue is', function (done) {
    sampler.checkEvents(agent)()

    /* sampler.checkEvents works by creating a timer and using
     * setTimeout to schedule an "immediate" callback execution,
     * which gives a rough idea of how much stuff is sitting pending
     * on the libuv event queue (and whether there's a lot of stuff
     * being handled through process.nextTick, which maintains its
     * own queue of immediate callbacks). It remains to be seen how
     * high this metric will ever get, but at least the underlying
     * timer has nanosecond precision (and probably significantly
     * greater-than-millisecond accuracy).
     */
    setTimeout(function () {
      const stats = agent.metrics.getOrCreateMetric('Events/wait')
      expect(stats.callCount).equal(1)
      /* process.hrtime will notice the passage of time, but this
       * happens too fast to measure any meaningful latency in versions
       * of Node that don't have process.hrtime available, so just make
       * sure we're not getting back undefined or null here.
       */
      expect(stats.total).a('number')
      if (process.hrtime) {
        expect(stats.total).above(0)
      }

      done()
    }, 0)
  })
})

function spinLoop(cb) {
  const DELAY = 5
  const COUNT = 20
  let spins = 0

  timeout()
  function timeout() {
    setTimeout(function () {
      let trash = []
      for (let i = 0; i < 100000; ++i) {
        trash.push([{ i: i }])
      }
      trash = null

      if (++spins < COUNT) {
        timeout()
      } else {
        setImmediate(cb)
      }
    }, DELAY)
  }
}
