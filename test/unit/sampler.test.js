/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const Agent = require('../../lib/agent')
const configurator = require('../../lib/config')
const sampler = require('../../lib/sampler')
const sinon = require('sinon')

const NAMES = require('../../lib/metrics/names')

tap.test('environmental sampler', function (t) {
  t.autoend()
  const numCpus = require('os').cpus().length

  t.beforeEach(function (t) {
    const sandbox = sinon.createSandbox()
    t.context.sandbox = sandbox
    // process.cpuUsage return values in cpu microseconds (1^-6)
    sandbox
      .stub(process, 'cpuUsage')
      .callsFake(() => ({ user: 1e6 * numCpus, system: 1e6 * numCpus }))
    // process.uptime returns values in seconds
    sandbox.stub(process, 'uptime').callsFake(() => 1)
    t.context.agent = new Agent(configurator.initialize())
  })

  t.afterEach(function (t) {
    sampler.stop()
    t.context.sandbox.restore()
  })

  t.test('should have the native-metrics package available', function (t) {
    t.doesNotThrow(function () {
      require('@newrelic/native-metrics')
    })
    t.end()
  })

  t.test('should still gather native metrics when bound and unbound', function (t) {
    const { agent } = t.context
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
      t.ok(loop.callCount > 1)
      t.ok(loop.max > 0)
      t.ok(loop.min <= loop.max)
      t.ok(loop.total >= loop.max)

      // Find at least one typed GC metric.
      const type = [
        'Scavenge',
        'MarkSweepCompact',
        'IncrementalMarking',
        'ProcessWeakCallbacks',
        'All'
      ].find((t) => agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + t).callCount)
      t.ok(type)

      const gc = agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + type)
      t.ok(gc.callCount >= 1)
      t.ok(gc.total >= 0.001) // At least 1 ms of GC

      const pause = agent.metrics.getOrCreateMetric(NAMES.GC.PAUSE_TIME)
      t.ok(pause.callCount >= gc.callCount)
      t.ok(pause.total >= gc.total)
      t.end()
    })
  })

  t.test('should gather loop metrics', function (t) {
    const { agent } = t.context
    sampler.start(agent)
    sampler.nativeMetrics.getLoopMetrics()
    spinLoop(function runLoop() {
      sampler.sampleLoop(agent, sampler.nativeMetrics)()

      const stats = agent.metrics.getOrCreateMetric(NAMES.LOOP.USAGE)
      t.ok(stats.callCount > 1)
      t.ok(stats.max > 0)
      t.ok(stats.min <= stats.max)
      t.ok(stats.total >= stats.max)
      t.end()
    })
  })

  t.test('should depend on Agent to provide the current metrics summary', function (t) {
    const { agent } = t.context
    t.doesNotThrow(function () {
      sampler.start(agent)
    })
    t.doesNotThrow(function () {
      sampler.stop(agent)
    })
    t.end()
  })

  t.test('should default to a state of stopped', function (t) {
    t.equal(sampler.state, 'stopped')
    t.end()
  })

  t.test('should say it is running after start', function (t) {
    const { agent } = t.context
    sampler.start(agent)
    t.equal(sampler.state, 'running')
    t.end()
  })

  t.test('should say it is stopped after stop', function (t) {
    const { agent } = t.context
    sampler.start(agent)
    t.equal(sampler.state, 'running')
    sampler.stop(agent)
    t.equal(sampler.state, 'stopped')
    t.end()
  })

  t.test('should gather CPU user utilization metric', function (t) {
    const { agent } = t.context
    sampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.USER_UTILIZATION)
    t.equal(stats.callCount, 1)
    t.equal(stats.total, 1)
    t.end()
  })

  t.test('should gather CPU system utilization metric', function (t) {
    const { agent } = t.context
    sampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.SYSTEM_UTILIZATION)
    t.equal(stats.callCount, 1)
    t.equal(stats.total, 1)
    t.end()
  })

  t.test('should gather CPU user time metric', function (t) {
    const { agent } = t.context
    sampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.USER_TIME)
    t.equal(stats.callCount, 1)
    t.equal(stats.total, numCpus)
    t.end()
  })

  t.test('should gather CPU sytem time metric', function (t) {
    const { agent } = t.context
    sampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.SYSTEM_TIME)
    t.equal(stats.callCount, 1)
    t.equal(stats.total, numCpus)
    t.end()
  })

  t.test('should gather GC metrics', function (t) {
    const { agent } = t.context
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
      t.ok(type)

      const gc = agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + type)
      t.ok(gc.callCount >= 1)

      // Assuming GC to take some amount of time.
      // With Node 12, the minimum for this work often seems to be
      // around 0.0008 on the servers.
      t.ok(gc.total >= 0.0004)

      const pause = agent.metrics.getOrCreateMetric(NAMES.GC.PAUSE_TIME)
      t.ok(pause.callCount >= gc.callCount)
      t.ok(pause.total >= gc.total)
      t.end()
    })
  })

  t.test('should not gather GC metrics if disabled', function (t) {
    const { agent } = t.context
    agent.config.plugins.native_metrics.enabled = false
    sampler.start(agent)
    t.not(sampler.nativeMetrics)
    t.end()
  })

  t.test('should catch if process.cpuUsage throws an error', function (t) {
    const { agent } = t.context
    const err = new Error('ohhhhhh boyyyyyy')
    process.cpuUsage.throws(err)
    sampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric('CPU/User/Utilization')
    t.equal(stats.callCount, 0)
    t.end()
  })

  t.test('should collect all specified memory statistics', function (t) {
    const { agent } = t.context
    sampler.sampleMemory(agent)()

    Object.keys(NAMES.MEMORY).forEach(function testStat(memoryStat) {
      const metricName = NAMES.MEMORY[memoryStat]
      const stats = agent.metrics.getOrCreateMetric(metricName)
      t.equal(stats.callCount, 1, `${metricName} callCount`)
      t.ok(stats.max > 1, `${metricName} max`)
    })
    t.end()
  })

  t.test('should catch if process.memoryUsage throws an error', function (t) {
    const { agent, sandbox } = t.context
    sandbox.stub(process, 'memoryUsage').callsFake(() => {
      throw new Error('your computer is on fire')
    })
    sampler.sampleMemory(agent)()

    const stats = agent.metrics.getOrCreateMetric('Memory/Physical')
    t.equal(stats.callCount, 0)
    t.end()
  })

  t.test('should have some rough idea of how deep the event queue is', function (t) {
    const { agent } = t.context
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
      t.equal(stats.callCount, 1)
      /* process.hrtime will notice the passage of time, but this
       * happens too fast to measure any meaningful latency in versions
       * of Node that don't have process.hrtime available, so just make
       * sure we're not getting back undefined or null here.
       */
      t.ok(typeof stats.total === 'number')
      if (process.hrtime) {
        t.ok(stats.total > 0)
      }

      t.end()
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
