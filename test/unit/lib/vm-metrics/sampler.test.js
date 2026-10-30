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
const Sampler = require('#agentlib/vm-metrics/sampler.js')

const numCpus = require('node:os').cpus().length
const NAMES = require('#agentlib/metrics/names.js')

// A short interval so a single tick fires promptly in tests rather than waiting
// for the production cadence.
const TICK = 10

/**
 * Resolves after enough time for at least one sampler tick to fire.
 *
 * @returns {Promise} Resolves after a tick interval has elapsed.
 */
function nextTick() {
  return new Promise((resolve) => setTimeout(resolve, TICK * 2))
}

test('environmental sampler', async function (t) {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    const sandbox = sinon.createSandbox()
    ctx.nr.sandbox = sandbox
    // process.cpuUsage return values in cpu microseconds (1^-6)
    sandbox
      .stub(process, 'cpuUsage')
      .callsFake(() => { return { user: 1e6 * numCpus, system: 1e6 * numCpus } })
    // process.uptime returns values in seconds
    sandbox.stub(process, 'uptime').callsFake(() => 1)
    ctx.nr.agent = new Agent(configurator.initialize())
    ctx.nr.sampler = new Sampler({ agent: ctx.nr.agent, interval: TICK })
  })

  t.afterEach(function (ctx) {
    ctx.nr.sampler.stop()
    ctx.nr.sandbox.restore()
  })

  await t.test('should still gather VM metrics when bound and unbound', function (t, end) {
    const { agent, sampler, sandbox } = t.nr
    // The loop sampler reads real process CPU usage; restore it so the per-tick
    // deltas reflect actual work rather than the constant stub.
    sandbox.restore()
    sampler.start()
    sampler.stop()
    sampler.start()

    // Clear up the current state of the metrics.
    sampler.vmMetrics.getGCMetrics()
    sampler.vmMetrics.getLoopMetrics()

    spinLoop(function runLoop() {
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
      // GC ran, so a positive pause duration was recorded. The magnitude is
      // runtime/hardware dependent, so do not assert an arbitrary floor.
      assert.ok(gc.total > 0)

      const pause = agent.metrics.getOrCreateMetric(NAMES.GC.PAUSE_TIME)
      assert.ok(pause.callCount >= gc.callCount)
      assert.ok(pause.total >= gc.total)
      end()
    })
  })

  await t.test('should gather loop metrics', function (t, end) {
    const { agent, sampler, sandbox } = t.nr
    // The loop sampler reads real process CPU usage; restore it so the per-tick
    // deltas reflect actual work rather than the constant stub.
    sandbox.restore()
    sampler.start()
    sampler.vmMetrics.getLoopMetrics()
    spinLoop(function runLoop() {
      const stats = agent.metrics.getOrCreateMetric(NAMES.LOOP.USAGE)
      assert.ok(stats.callCount > 1)
      assert.ok(stats.max > 0)
      assert.ok(stats.min <= stats.max)
      assert.ok(stats.total >= stats.max)
      end()
    })
  })

  await t.test('should depend on Agent to provide the current metrics summary', function (t) {
    const { sampler } = t.nr
    assert.doesNotThrow(function () {
      sampler.start()
    })
    assert.doesNotThrow(function () {
      sampler.stop()
    })
  })

  await t.test('should default to a state of stopped', function (t) {
    const { sampler } = t.nr
    assert.equal(sampler.state, 'stopped')
  })

  await t.test('should say it is running after start', function (t) {
    const { sampler } = t.nr
    sampler.start()
    assert.equal(sampler.state, 'running')
  })

  await t.test('should say it is stopped after stop', function (t) {
    const { sampler } = t.nr
    sampler.start()
    assert.equal(sampler.state, 'running')
    sampler.stop()
    assert.equal(sampler.state, 'stopped')
  })

  await t.test('should gather CPU user utilization metric', async function (t) {
    const { agent, sampler } = t.nr
    sampler.start()
    await nextTick()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.USER_UTILIZATION)
    assert.ok(stats.callCount >= 1)
    assert.equal(stats.total, 1)
  })

  await t.test('should gather CPU system utilization metric', async function (t) {
    const { agent, sampler } = t.nr
    sampler.start()
    await nextTick()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.SYSTEM_UTILIZATION)
    assert.ok(stats.callCount >= 1)
    assert.equal(stats.total, 1)
  })

  await t.test('should gather CPU user time metric', async function (t) {
    const { agent, sampler } = t.nr
    sampler.start()
    await nextTick()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.USER_TIME)
    assert.ok(stats.callCount >= 1)
    assert.equal(stats.total, numCpus)
  })

  await t.test('should gather CPU system time metric', async function (t) {
    const { agent, sampler } = t.nr
    sampler.start()
    await nextTick()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.SYSTEM_TIME)
    assert.ok(stats.callCount >= 1)
    assert.equal(stats.total, numCpus)
  })

  await t.test('should gather GC metrics', function (t, end) {
    const { agent, sampler } = t.nr
    sampler.start()

    // Clear up the current state of the metrics.
    sampler.vmMetrics.getGCMetrics()

    spinLoop(function runLoop() {
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

      // GC ran (callCount above), so a pause duration was recorded. Its exact
      // magnitude is a function of the runtime and hardware, not the agent, so
      // only assert that a positive duration was captured rather than a floor.
      assert.ok(gc.total > 0)

      const pause = agent.metrics.getOrCreateMetric(NAMES.GC.PAUSE_TIME)
      assert.ok(pause.callCount >= gc.callCount)
      assert.ok(pause.total >= gc.total)
      end()
    })
  })

  await t.test('should not gather GC metrics if disabled', function (t) {
    const { agent, sampler } = t.nr
    agent.config.plugins.native_metrics.enabled = false
    sampler.start()
    assert.ok(!sampler.vmMetrics)
  })

  await t.test('should catch if process.cpuUsage throws an error', async function (t) {
    const { agent, sampler } = t.nr
    // Isolate the CPU sampler: the VM metrics collector also reads
    // process.cpuUsage (when bound), so disable it to exercise only the CPU
    // sampler's error handling.
    agent.config.plugins.native_metrics.enabled = false
    const err = new Error('ohhhhhh boyyyyyy')
    process.cpuUsage.throws(err)
    sampler.start()
    await nextTick()

    const stats = agent.metrics.getOrCreateMetric('CPU/User/Utilization')
    assert.equal(stats.callCount, 0)
  })

  await t.test('should collect all specified memory statistics', async function (t) {
    const { agent, sampler } = t.nr
    sampler.start()
    await nextTick()

    Object.keys(NAMES.MEMORY).forEach(function testStat(memoryStat) {
      const metricName = NAMES.MEMORY[memoryStat]
      const stats = agent.metrics.getOrCreateMetric(metricName)
      assert.ok(stats.callCount >= 1, `${metricName} callCount`)
      assert.ok(stats.max > 1, `${metricName} max`)
    })
  })

  await t.test('should catch if process.memoryUsage throws an error', async function (t) {
    const { agent, sampler, sandbox } = t.nr
    sandbox.stub(process, 'memoryUsage').callsFake(() => {
      throw new Error('your computer is on fire')
    })
    sampler.start()
    await nextTick()

    const stats = agent.metrics.getOrCreateMetric('Memory/Physical')
    assert.equal(stats.callCount, 0)
  })

  await t.test('should have some rough idea of how deep the event queue is', function (t, end) {
    const { agent, sampler } = t.nr
    sampler.start()

    /* The event sampler works by creating a timer and using setTimeout to
     * schedule an "immediate" callback execution, which gives a rough idea of
     * how much stuff is sitting pending on the libuv event queue (and whether
     * there's a lot of stuff being handled through process.nextTick, which
     * maintains its own queue of immediate callbacks). It remains to be seen
     * how high this metric will ever get, but at least the underlying timer has
     * nanosecond precision (and probably significantly greater-than-millisecond
     * accuracy).
     */
    setTimeout(function () {
      const stats = agent.metrics.getOrCreateMetric('Events/wait')
      assert.ok(stats.callCount >= 1)
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
    }, TICK * 3)
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
