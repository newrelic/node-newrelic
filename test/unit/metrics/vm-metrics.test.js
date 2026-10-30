/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const { execFile } = require('node:child_process')

const createEmitter = require('#agentlib/metrics/vm-metrics.js')
const { VMMetricsEmitter, Metric } = createEmitter

/**
 * Allocates and discards a large amount of garbage across several macrotask
 * turns to coax the V8 garbage collector into running, yielding between rounds
 * so the performance observer can flush its entries.
 *
 * @param {number} [rounds] The number of allocation rounds to perform.
 * @returns {Promise} Resolves once the rounds complete.
 */
async function churn(rounds = 15) {
  for (let round = 0; round < rounds; round++) {
    let trash = []
    for (let j = 0; j < 200000; j++) {
      trash.push([{ j }])
    }
    trash = null
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

test('vm-metrics', async (t) => {
  await t.test('Metric accumulator matches the native field shape', () => {
    const metric = new Metric()
    assert.deepEqual(
      { total: metric.total, min: metric.min, max: metric.max, sumOfSquares: metric.sumOfSquares, count: metric.count },
      { total: 0, min: 0, max: 0, sumOfSquares: 0, count: 0 }
    )

    metric.add(2)
    metric.add(4)
    assert.equal(metric.count, 2)
    assert.equal(metric.total, 6)
    assert.equal(metric.min, 2)
    assert.equal(metric.max, 4)
    assert.equal(metric.sumOfSquares, 20) // 2^2 + 4^2

    metric.reset()
    assert.equal(metric.count, 0)
    assert.equal(metric.total, 0)
  })

  await t.test('factory returns a singleton', () => {
    assert.equal(createEmitter(), createEmitter())
  })

  await t.test('starts unbound', () => {
    const emitter = new VMMetricsEmitter()
    assert.equal(emitter.bound, false)
  })

  await t.test('bind/unbind toggles the bound flag and is idempotent', () => {
    const emitter = new VMMetricsEmitter()
    emitter.bind()
    assert.equal(emitter.bound, true)
    emitter.bind() // no-op
    assert.equal(emitter.bound, true)
    emitter.unbind()
    assert.equal(emitter.bound, false)
    emitter.unbind() // no-op
    assert.equal(emitter.bound, false)
  })

  await t.test('getGCMetrics returns typed buckets and an All aggregate, then resets', async () => {
    const emitter = new VMMetricsEmitter()
    emitter.bind()
    // Clear any entries observed during bind.
    emitter.getGCMetrics()

    await churn()

    const gc = emitter.getGCMetrics()
    const types = Object.keys(gc)
    assert.ok(types.length > 0, 'at least one GC type was recorded')

    // The All aggregate must be present and sum every collection.
    assert.ok(gc.All, 'All aggregate present')
    assert.equal(gc.All.typeId, 31)
    assert.equal(gc.All.type, 'All')
    assert.ok(gc.All.metrics.count > 0)
    assert.ok(gc.All.metrics.total > 0)

    // Every typed bucket carries the native metric shape.
    for (const type of types) {
      const bucket = gc[type]
      assert.equal(bucket.type, type)
      assert.ok(bucket.metrics.count > 0)
      assert.ok(bucket.metrics.total > 0)
      assert.ok(bucket.metrics.min <= bucket.metrics.max)
      assert.ok(typeof bucket.metrics.sumOfSquares === 'number')
    }

    // A read resets the accumulators.
    assert.deepEqual(emitter.getGCMetrics(), Object.create(null))

    emitter.unbind()
  })

  await t.test('only known GC type names are emitted', async () => {
    const emitter = new VMMetricsEmitter()
    emitter.bind()
    emitter.getGCMetrics()
    await churn()

    const allowed = new Set([
      'Scavenge',
      'MarkSweepCompact',
      'IncrementalMarking',
      'ProcessWeakCallbacks',
      'All'
    ])
    for (const type of Object.keys(emitter.getGCMetrics())) {
      assert.ok(allowed.has(type), `${type} is a known GC type name`)
    }

    emitter.unbind()
  })

  await t.test('getLoopMetrics accumulates CPU usage and resets on read', async () => {
    const emitter = new VMMetricsEmitter()
    emitter.bind()
    emitter.getLoopMetrics()

    // Let the per-tick sampler run across several loop iterations while doing
    // real work so the CPU deltas are non-zero.
    await churn()
    await churn()

    const { usage } = emitter.getLoopMetrics()
    assert.ok(usage.count > 0, 'loop usage samples were collected')
    assert.ok(usage.total > 0, 'positive CPU usage accumulated')
    assert.ok(usage.min <= usage.max)

    // A read resets the accumulator.
    const after = emitter.getLoopMetrics()
    assert.equal(after.usage.count, 0)
    assert.equal(after.usage.total, 0)

    emitter.unbind()
  })

  await t.test('does not keep the event loop alive while bound', (t, end) => {
    // The loop sampler must be unref'd: binding and leaving it bound must not
    // by itself prevent the process from exiting. Run in a child process that
    // binds and never unbinds, and assert it exits cleanly on its own. If the
    // sampler were ref'd, the child would hang until killed by the timeout.
    const modulePath = require.resolve('#agentlib/metrics/vm-metrics.js')
    const script = `
      const emitter = require(${JSON.stringify(modulePath)})()
      emitter.bind()
      // No unbind, no other work keeping the loop alive. A properly unref'd
      // sampler lets the process exit immediately.
    `
    const child = execFile(
      process.execPath,
      [
        '-e',
        script
      ],
      { timeout: 5000 },
      (err) => {
        assert.ifError(err, 'child exited cleanly without hanging')
        end()
      }
    )
    assert.ok(child.pid, 'child process spawned')
  })
})
