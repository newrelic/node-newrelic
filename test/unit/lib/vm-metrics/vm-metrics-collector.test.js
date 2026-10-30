/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')
const { execFile } = require('node:child_process')

const VMMetricsCollector = require('#agentlib/vm-metrics/vm-metrics-collector.js')

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

test('vm-metrics-collector', async (t) => {
  await t.test('starts unbound', () => {
    const collector = new VMMetricsCollector()
    assert.equal(collector.bound, false)
  })

  await t.test('bind/unbind toggles the bound flag and is idempotent', () => {
    const collector = new VMMetricsCollector()
    collector.bind()
    assert.equal(collector.bound, true)
    collector.bind() // no-op
    assert.equal(collector.bound, true)
    collector.unbind()
    assert.equal(collector.bound, false)
    collector.unbind() // no-op
    assert.equal(collector.bound, false)
  })

  await t.test('getGCMetrics returns typed buckets and an All aggregate, then resets', async () => {
    const collector = new VMMetricsCollector()
    collector.bind()
    // Clear any entries observed during bind.
    collector.getGCMetrics()

    await churn()

    const gc = collector.getGCMetrics()
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
    assert.deepEqual(collector.getGCMetrics(), Object.create(null))

    collector.unbind()
  })

  await t.test('only known GC type names are emitted', async () => {
    const collector = new VMMetricsCollector()
    collector.bind()
    collector.getGCMetrics()
    await churn()

    const allowed = new Set([
      'Scavenge',
      'MarkSweepCompact',
      'IncrementalMarking',
      'ProcessWeakCallbacks',
      'All'
    ])
    for (const type of Object.keys(collector.getGCMetrics())) {
      assert.ok(allowed.has(type), `${type} is a known GC type name`)
    }

    collector.unbind()
  })

  await t.test('getLoopMetrics accumulates CPU usage and resets on read', async () => {
    const collector = new VMMetricsCollector()
    collector.bind()
    collector.getLoopMetrics()

    // Let the per-tick sampler run across several loop iterations while doing
    // real work so the CPU deltas are non-zero.
    await churn()
    await churn()

    const { usage } = collector.getLoopMetrics()
    assert.ok(usage.count > 0, 'loop usage samples were collected')
    assert.ok(usage.total > 0, 'positive CPU usage accumulated')
    assert.ok(usage.min <= usage.max)

    // A read resets the accumulator.
    const after = collector.getLoopMetrics()
    assert.equal(after.usage.count, 0)
    assert.equal(after.usage.total, 0)

    collector.unbind()
  })

  await t.test('does not keep the event loop alive while bound', (t, end) => {
    // The loop sampler must be unref'd: binding and leaving it bound must not
    // by itself prevent the process from exiting. Run in a child process that
    // binds and never unbinds, and assert it exits cleanly on its own. If the
    // sampler were ref'd, the child would hang until killed by the timeout.
    const modulePath = require.resolve('#agentlib/vm-metrics/vm-metrics-collector.js')
    const script = `
      const VMMetricsCollector = require(${JSON.stringify(modulePath)})
      const collector = new VMMetricsCollector()
      collector.bind()
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
