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
const churn = require('./helpers/churn.js')

const numCpus = require('node:os').cpus().length
const NAMES = require('#agentlib/metrics/names.js')

// A short interval so a single tick fires promptly in tests rather than waiting
// for the production cadence.
const TICK = 10

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

  await t.test('should gather GC metrics from real activity', async function (t) {
    const { agent, sampler, sandbox } = t.nr
    // The loop sampler reads real process CPU usage; restore it so the per-tick
    // deltas reflect actual work rather than the constant stub.
    sandbox.restore()

    // start() binds the collector. Generate real GC activity while bound, then
    // take one deterministic sample() to read the accumulated data — no
    // reliance on timer scheduling, so this is stable under CPU contention.
    sampler.start()
    await churn()
    sampler.sample()

    // At least one typed GC bucket was recorded from the churn above.
    const type = [
      'Scavenge',
      'MinorMarkCompact',
      'MarkSweepCompact',
      'IncrementalMarking',
      'ProcessWeakCallbacks'
    ].find((t) => agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + t).callCount)
    assert.ok(type, 'at least one typed GC bucket recorded')

    const gc = agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + type)
    assert.ok(gc.callCount >= 1)
    assert.ok(gc.total > 0)

    const pause = agent.metrics.getOrCreateMetric(NAMES.GC.PAUSE_TIME)
    assert.ok(pause.callCount >= gc.callCount)
    assert.ok(pause.total >= gc.total)
  })

  await t.test('should gather event loop CPU usage from real activity', async function (t) {
    const { agent, sampler, sandbox } = t.nr
    // Loop usage is real process CPU per tick; restore the stub and let real
    // event-loop turns accumulate before reading.
    sandbox.restore()

    sampler.start()
    await churn()
    sampler.sample()

    // Loop usage merges the collector's `{count,...}` bundle; assert on the
    // recorded magnitudes rather than callCount (the merged bundle uses `count`
    // and zero-count samples do not increment callCount).
    const stats = agent.metrics.getOrCreateMetric(NAMES.LOOP.USAGE)
    assert.ok(stats.max > 0, 'recorded a positive per-tick CPU sample')
    assert.ok(stats.min >= 0)
    assert.ok(stats.min <= stats.max)
    assert.ok(stats.total >= stats.max)
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

  await t.test('should rebind a fresh VM metrics collector after stop/start', function (t) {
    const { sampler } = t.nr
    sampler.start()
    const first = sampler.vmMetrics
    assert.ok(first, 'collector created on first start')
    assert.equal(first.bound, true)

    // stop() unbinds and clears the collector so a new one is built next start.
    sampler.stop()
    assert.equal(first.bound, false, 'collector unbound on stop')
    assert.equal(sampler.vmMetrics, null, 'collector cleared on stop')

    sampler.start()
    assert.ok(sampler.vmMetrics, 'collector recreated on restart')
    assert.notEqual(sampler.vmMetrics, first, 'a fresh collector is bound')
    assert.equal(sampler.vmMetrics.bound, true)

    // Both samplers still record after the restart cycle.
    sampler.sample()
    assert.ok(sampler.vmMetrics, 'collector remains bound after a post-restart sample')
  })

  // start() records nothing until an interval elapses; sample() takes one
  // deterministic pass, so these assert that single sample rather than racing a
  // timer interval.
  await t.test('should gather CPU user utilization metric', function (t) {
    const { agent, sampler } = t.nr
    sampler.start()
    sampler.sample()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.USER_UTILIZATION)
    assert.equal(stats.callCount, 1)
    assert.equal(stats.total, 1)
  })

  await t.test('should gather CPU system utilization metric', function (t) {
    const { agent, sampler } = t.nr
    sampler.start()
    sampler.sample()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.SYSTEM_UTILIZATION)
    assert.equal(stats.callCount, 1)
    assert.equal(stats.total, 1)
  })

  await t.test('should gather CPU user time metric', function (t) {
    const { agent, sampler } = t.nr
    sampler.start()
    sampler.sample()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.USER_TIME)
    assert.equal(stats.callCount, 1)
    assert.equal(stats.total, numCpus)
  })

  await t.test('should gather CPU system time metric', function (t) {
    const { agent, sampler } = t.nr
    sampler.start()
    sampler.sample()

    const stats = agent.metrics.getOrCreateMetric(NAMES.CPU.SYSTEM_TIME)
    assert.equal(stats.callCount, 1)
    assert.equal(stats.total, numCpus)
  })

  await t.test('should gather GC metrics', function (t, end) {
    const { agent, sampler } = t.nr
    sampler.start()

    // Clear up the current state of the metrics.
    sampler.vmMetrics.getGCMetrics()

    spinLoop(function runLoop() {
      // Take one deterministic sample to record the GC that occurred above.
      sampler.sample()

      // Find at least one typed GC metric.
      const type = [
        'Scavenge',
        'MinorMarkCompact',
        'MarkSweepCompact',
        'IncrementalMarking',
        'ProcessWeakCallbacks'
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

  await t.test('should count each GC pause exactly once', function (t, end) {
    const { agent, sampler } = t.nr
    sampler.start()

    // Clear up the current state of the metrics.
    sampler.vmMetrics.getGCMetrics()

    spinLoop(function runLoop() {
      // Take one deterministic sample to record the GC that occurred above.
      sampler.sample()

      // Every collection belongs to exactly one GC type, so the total pause
      // metric must equal the sum of the typed metrics: each collection is
      // counted once.
      const typed = [
        'Scavenge',
        'MinorMarkCompact',
        'MarkSweepCompact',
        'IncrementalMarking',
        'ProcessWeakCallbacks'
      ].map((type) => agent.metrics.getOrCreateMetric(NAMES.GC.PREFIX + type))
      const typedCount = typed.reduce((sum, stats) => sum + stats.callCount, 0)
      const typedTotal = typed.reduce((sum, stats) => sum + stats.total, 0)
      assert.ok(typedCount > 0, 'at least one typed GC was recorded')

      const pause = agent.metrics.getOrCreateMetric(NAMES.GC.PAUSE_TIME)
      assert.equal(pause.callCount, typedCount)
      assert.ok(
        Math.abs(pause.total - typedTotal) < 1e-9,
        `pause total ${pause.total} should equal typed total ${typedTotal}`
      )
      end()
    })
  })

  await t.test('should not gather GC metrics if disabled', function (t) {
    const { agent, sampler } = t.nr
    agent.config.plugins.native_metrics.enabled = false
    sampler.start()
    assert.ok(!sampler.vmMetrics)
  })

  await t.test('should log a debug message for an unknown GC type', async function (t) {
    const { agent } = t.nr
    const logger = {
      trace() {},
      debug: sinon.stub()
    }
    const sampler = new Sampler({ agent, logger, interval: TICK })
    // Inject a collector stub that reports a GC entry without a type, which
    // only a malformed entry would produce. The real collector always sets a
    // type, so this exercises the otherwise unreachable fallback branch.
    sampler.vmMetrics = {
      bound: true,
      bind() {},
      unbind() {},
      getLoopMetrics() {
        return { usage: { total: 0, min: 0, max: 0, sumOfSquares: 0, count: 0 } }
      },
      getGCMetrics() {
        return {
          42: {
            typeId: 42,
            type: undefined,
            metrics: { total: 1, min: 1, max: 1, sumOfSquares: 1, count: 1 }
          }
        }
      }
    }
    sampler.start()
    sampler.sample()
    sampler.stop()

    assert.equal(logger.debug.calledWith(sinon.match.any, 'Unknown GC type %j', 42), true)
  })

  await t.test('should catch if process.cpuUsage throws an error', function (t) {
    const { agent, sampler } = t.nr
    // Isolate the CPU sampler: the VM metrics collector also reads
    // process.cpuUsage (when bound), so disable it to exercise only the CPU
    // sampler's error handling.
    agent.config.plugins.native_metrics.enabled = false
    const err = new Error('ohhhhhh boyyyyyy')
    process.cpuUsage.throws(err)
    sampler.start()
    sampler.sample()

    const stats = agent.metrics.getOrCreateMetric('CPU/User/Utilization')
    assert.equal(stats.callCount, 0)
  })

  await t.test('should collect all specified memory statistics', function (t) {
    const { agent, sampler } = t.nr
    sampler.start()
    sampler.sample()

    Object.keys(NAMES.MEMORY).forEach(function testStat(memoryStat) {
      const metricName = NAMES.MEMORY[memoryStat]
      const stats = agent.metrics.getOrCreateMetric(metricName)
      assert.equal(stats.callCount, 1, `${metricName} callCount`)
      assert.ok(stats.max > 1, `${metricName} max`)
    })
  })

  await t.test('should catch if process.memoryUsage throws an error', function (t) {
    const { agent, sampler, sandbox } = t.nr
    sandbox.stub(process, 'memoryUsage').callsFake(() => {
      throw new Error('your computer is on fire')
    })
    sampler.start()
    sampler.sample()

    const stats = agent.metrics.getOrCreateMetric('Memory/Physical')
    assert.equal(stats.callCount, 0)
  })

  await t.test('should have some rough idea of how deep the event queue is', function (t, end) {
    const { agent, sampler } = t.nr
    sampler.start()
    sampler.sample()

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

  await t.test('should track and cancel multiple pending event-queue probes', function (t, end) {
    const { agent } = t.nr
    // Use an interval long enough that the recurring timer never fires during
    // the test, so the only probes are the ones scheduled explicitly below.
    const sampler = new Sampler({ agent, interval: 60_000 })
    sampler.start()

    // Each #checkEvents schedules a setTimeout(0) probe that records on the next
    // loop turn. Simulate those probes being delayed past subsequent sampling
    // passes by taking several passes synchronously: every probe is now pending
    // at once, so more than one timer is tracked simultaneously.
    sampler.sample()
    sampler.sample()
    sampler.sample()

    // stop() must cancel all of them. If tracking only held the most recent
    // handle, the earlier probes would leak and fire after stop(), recording
    // against the agent.
    sampler.stop()

    // Let the loop turn so any un-cancelled probe would have fired.
    setTimeout(function () {
      const stats = agent.metrics.getOrCreateMetric('Events/wait')
      assert.equal(stats.callCount, 0, 'all pending probes were cancelled by stop()')
      end()
    }, 50)
  })

  await t.test('should record every pending probe when they all fire', function (t, end) {
    const { agent } = t.nr
    const sampler = new Sampler({ agent, interval: 60_000 })
    sampler.start()

    // Three pending probes, none cancelled: each should fire and record once.
    sampler.sample()
    sampler.sample()
    sampler.sample()

    setTimeout(function () {
      const stats = agent.metrics.getOrCreateMetric('Events/wait')
      assert.equal(stats.callCount, 3, 'each tracked probe fired and recorded')
      sampler.stop()
      end()
    }, 50)
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
