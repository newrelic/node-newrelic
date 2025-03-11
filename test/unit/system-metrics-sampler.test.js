/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const Agent = require('#agentlib/agent.js')
const configurator = require('#agentlib/config/index.js')
const systemMetricsSampler = require('#agentlib/system-metrics-sampler.js')

const numCpus = require('node:os').cpus().length
const NAMES = require('#agentlib/metrics/names.js')

test('environmental sampler', async function (t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    const sandbox = sinon.createSandbox()
    ctx.nr.sandbox = sandbox
    // process.cpuUsage return values in cpu microseconds (1^-6)
    sandbox
      .stub(process, 'cpuUsage')
      .callsFake(() => ({ user: 1e6 * numCpus, system: 1e6 * numCpus }))
    // process.uptime returns values in seconds
    sandbox.stub(process, 'uptime').callsFake(() => 1)
    ctx.nr.agent = new Agent(configurator.initialize())
  })

  t.afterEach(function (ctx) {
    systemMetricsSampler.stop()
    ctx.nr.sandbox.restore()
  })

  await t.test('should have the native-metrics package available', function () {
    assert.doesNotThrow(function () {
      require('@newrelic/native-metrics')
    })
  })

  await t.test('should still gather native metrics when bound and unbound', function (t, end) {
    const { agent } = t.nr
    systemMetricsSampler.start(agent)
    systemMetricsSampler.stop()
    systemMetricsSampler.start(agent)

    // Clear up the current state of the metrics.
    systemMetricsSampler.nativeMetrics.getGCMetrics()
    systemMetricsSampler.nativeMetrics.getLoopMetrics()

    spinLoop(function runLoop() {
      systemMetricsSampler.sampleLoop(agent, systemMetricsSampler.nativeMetrics)()
      systemMetricsSampler.sampleGc(agent, systemMetricsSampler.nativeMetrics)()

      const loop = agent.metrics.getOrCreateMetric(NAMES.LOOP.USAGE)
      assert.ok(loop.callCount > 1)
      assert.ok(loop.max > 0)
      assert.ok(loop.min <= loop.max)
      assert.ok(loop.total >= loop.max)

      // Find at least one typed GC metric.
      const type = [
        'Scavenge',
        'MarkSweepCompact',
        'IncrementalMarking',
        'ProcessWeakCallbacks',
        'All'
      ].find((t) => agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + t).callCount)
      assert.ok(type)

      const gc = agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + type)
      assert.ok(gc.callCount >= 1)
      assert.ok(gc.total >= 0.001) // At least 1 ms of GC

      const pause = agent.metrics.getOrCreateMetric(NAMES.GC.PAUSE_TIME)
      assert.ok(pause.callCount >= gc.callCount)
      assert.ok(pause.total >= gc.total)
      end()
    })
  })

  await t.test('should gather loop metrics', function (t, end) {
    const { agent } = t.nr
    systemMetricsSampler.start(agent)
    systemMetricsSampler.nativeMetrics.getLoopMetrics()
    spinLoop(function runLoop() {
      systemMetricsSampler.sampleLoop(agent, systemMetricsSampler.nativeMetrics)()

      const stats = agent.metrics.getOrCreateMetric(NAMES.LOOP.USAGE)
      assert.ok(stats.callCount > 1)
      assert.ok(stats.max > 0)
      assert.ok(stats.min <= stats.max)
      assert.ok(stats.total >= stats.max)
      end()
    })
  })

  await t.test('should depend on Agent to provide the current metrics summary', function (t) {
    const { agent } = t.nr
    assert.doesNotThrow(function () {
      systemMetricsSampler.start(agent)
    })
    assert.doesNotThrow(function () {
      systemMetricsSampler.stop(agent)
    })
  })

  await t.test('should default to a state of stopped', function () {
    assert.equal(systemMetricsSampler.state, 'stopped')
  })

  await t.test('should say it is running after start', function (t) {
    const { agent } = t.nr
    systemMetricsSampler.start(agent)
    assert.equal(systemMetricsSampler.state, 'running')
  })

  await t.test('should say it is stopped after stop', function (t) {
    const { agent } = t.nr
    systemMetricsSampler.start(agent)
    assert.equal(systemMetricsSampler.state, 'running')
    systemMetricsSampler.stop(agent)
    assert.equal(systemMetricsSampler.state, 'stopped')
  })

  await t.test('should gather CPU user utilization metric', function (t) {
    const { agent } = t.nr
    systemMetricsSampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.USER_UTILIZATION)
    assert.equal(stats.callCount, 1)
    assert.equal(stats.total, 1)
  })

  await t.test('should gather CPU system utilization metric', function (t) {
    const { agent } = t.nr
    systemMetricsSampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.SYSTEM_UTILIZATION)
    assert.equal(stats.callCount, 1)
    assert.equal(stats.total, 1)
  })

  await t.test('should gather CPU user time metric', function (t) {
    const { agent } = t.nr
    systemMetricsSampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.USER_TIME)
    assert.equal(stats.callCount, 1)
    assert.equal(stats.total, numCpus)
  })

  await t.test('should gather CPU sytem time metric', function (t) {
    const { agent } = t.nr
    systemMetricsSampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.SYSTEM_TIME)
    assert.equal(stats.callCount, 1)
    assert.equal(stats.total, numCpus)
  })

  await t.test('should gather GC metrics', function (t, end) {
    const { agent } = t.nr
    systemMetricsSampler.start(agent)

    // Clear up the current state of the metrics.
    systemMetricsSampler.nativeMetrics.getGCMetrics()

    spinLoop(function runLoop() {
      systemMetricsSampler.sampleGc(agent, systemMetricsSampler.nativeMetrics)()

      // Find at least one typed GC metric.
      const type = [
        'Scavenge',
        'MarkSweepCompact',
        'IncrementalMarking',
        'ProcessWeakCallbacks',
        'All'
      ].find((t) => agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + t).callCount)
      assert.ok(type)

      const gc = agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + type)
      assert.ok(gc.callCount >= 1)

      // Assuming GC to take some amount of time.
      // With Node 12, the minimum for this work often seems to be
      // around 0.0008 on the servers.
      assert.ok(gc.total >= 0.0004)

      const pause = agent.metrics.getOrCreateMetric(NAMES.GC.PAUSE_TIME)
      assert.ok(pause.callCount >= gc.callCount)
      assert.ok(pause.total >= gc.total)
      end()
    })
  })

  await t.test('should not gather GC metrics if disabled', function (t) {
    const { agent } = t.nr
    agent.config.plugins.native_metrics.enabled = false
    systemMetricsSampler.start(agent)
    assert.ok(!systemMetricsSampler.nativeMetrics)
  })

  await t.test('should catch if process.cpuUsage throws an error', function (t) {
    const { agent } = t.nr
    const err = new Error('ohhhhhh boyyyyyy')
    process.cpuUsage.throws(err)
    systemMetricsSampler.sampleCpu(agent)()

    const stats = agent.metrics.getOrCreateMetric('CPU/User/Utilization')
    assert.equal(stats.callCount, 0)
  })

  await t.test('should collect all specified memory statistics', function (t) {
    const { agent } = t.nr
    systemMetricsSampler.sampleMemory(agent)()

    Object.keys(NAMES.MEMORY).forEach(function testStat(memoryStat) {
      const metricName = NAMES.MEMORY[memoryStat]
      const stats = agent.metrics.getOrCreateMetric(metricName)
      assert.equal(stats.callCount, 1, `${metricName} callCount`)
      assert.ok(stats.max > 1, `${metricName} max`)
    })
  })

  await t.test('should catch if process.memoryUsage throws an error', function (t) {
    const { agent, sandbox } = t.nr
    sandbox.stub(process, 'memoryUsage').callsFake(() => {
      throw new Error('your computer is on fire')
    })
    systemMetricsSampler.sampleMemory(agent)()

    const stats = agent.metrics.getOrCreateMetric('Memory/Physical')
    assert.equal(stats.callCount, 0)
  })

  await t.test('should have some rough idea of how deep the event queue is', function (t, end) {
    const { agent } = t.nr
    systemMetricsSampler.checkEvents(agent)()

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
      assert.equal(stats.callCount, 1)
      /* process.hrtime will notice the passage of time, but this
       * happens too fast to measure any meaningful latency in versions
       * of Node that don't have process.hrtime available, so just make
       * sure we're not getting back undefined or null here.
       */
      assert.ok(typeof stats.total === 'number')
      if (process.hrtime) {
        assert.ok(stats.total > 0)
      }

      end()
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
        trash.push([{ i }])
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
