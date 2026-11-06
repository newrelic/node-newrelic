/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const TraceIdRatioBasedSampler = require('#agentlib/samplers/ratio-based-sampler.js')
const { tspl } = require('@matteo.collina/tspl')
const { generateRandomTraceId } = helper

test('should set toString and Object.prototype.toString correctly', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ ratio: 0.5 })
  assert.equal(sampler.toString(), 'TraceIdRatioBasedSampler')
  assert.equal(Object.prototype.toString.call(sampler), '[object TraceIdRatioBasedSampler]')
})

test('should create a TraceIdRatioBasedSampler with the correct ratio', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ ratio: 0.5 })
  assert.strictEqual(sampler._ratio, 0.5)
})

test('should normalize bad ratio, above bound', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ ratio: 1.5 })
  assert.strictEqual(sampler._ratio, 1)
})

test('should normalize bad ratio, below bound', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ ratio: -0.5 })
  assert.strictEqual(sampler._ratio, 0)
})

test('should default to 0 if ratio NaN', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ ratio: 'invalid' })
  assert.strictEqual(sampler._ratio, 0)
})

test('should always sample if ratio=1', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ ratio: 1 })
  assert.strictEqual(sampler.shouldSample(generateRandomTraceId()), true)
})

test('should never sample if ratio=0', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ ratio: 0 })
  assert.strictEqual(sampler.shouldSample(generateRandomTraceId()), false)
})

test('should accumulate trace ID correctly', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ ratio: 0.5 })
  const traceId = '0'.repeat(32)
  const accumulated = sampler._accumulate(traceId)
  assert.strictEqual(accumulated, 0)
})

test('should sample consistently for same trace ID', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ ratio: 0.5 })
  const traceId = generateRandomTraceId()
  const result1 = sampler.shouldSample(traceId)
  const result2 = sampler.shouldSample(traceId)
  assert.strictEqual(result1, result2)
})

test('should sample approximately correct percentage of traces', (t) => {
  const ratio = 0.5
  const iterations = 25000
  // For 25000 iterations, binomial distribution states that
  // the standard error rate should be around 0.3%, but this
  // test is very flaky, so we will use 1% as the error margin.
  const errorMargin = 0.01
  const sampler = new TraceIdRatioBasedSampler({ ratio })
  let sampledCount = 0

  for (let i = 0; i < iterations; i++) {
    if (sampler.shouldSample(generateRandomTraceId())) {
      sampledCount++
    }
  }

  const actualRatio = sampledCount / iterations
  assert.ok(actualRatio > ratio - errorMargin && actualRatio < ratio + errorMargin,
    `should sample approximately ${ratio * 100}% of traces, got ${actualRatio * 100}%`)
})

test('integration tests', async (t) => {
  await t.test('should set `sampled` and `priority` correctly on sampled transaction', (t, end) => {
    const agent = helper.loadMockedAgent({
      distributed_tracing: {
        sampler: {
          root: {
            trace_id_ratio_based: { ratio: 1 }
          }
        }
      }
    })
    t.after(() => {
      helper.unloadAgent(agent)
    })
    helper.runInTransaction(agent, (txn) => {
      txn.end()
      assert.strictEqual(txn.sampled, true)
      assert.ok(txn.priority > 1)
      end()
    })
  })

  await t.test('should set `sampled` and `priority` correctly on not sampled transaction', (t, end) => {
    const agent = helper.loadMockedAgent({
      distributed_tracing: {
        sampler: {
          root: {
            trace_id_ratio_based: { ratio: 0 }
          }
        }
      }
    })
    t.after(() => {
      helper.unloadAgent(agent)
    })

    helper.runInTransaction(agent, (txn) => {
      txn.end()
      assert.strictEqual(txn.sampled, false)
      assert.ok(txn.priority < 1)
      end()
    })
  })

  await t.test('should sample approximately correct percentage of traces', async (t) => {
    const plan = tspl(t, { plan: 1 })
    const RATIO_VALUE = 0.5
    // For 25000 iterations, binomial distribution states that
    // the standard error rate should be around 0.3%, but this
    // test is very flaky, so we will use 1.5% as the error margin.
    const ERROR_MARGIN = 0.015
    const numTxs = 25000
    const agent = helper.loadMockedAgent({
      distributed_tracing: {
        sampler: {
          root: {
            trace_id_ratio_based: { ratio: RATIO_VALUE }
          }
        }
      }
    })
    t.after(() => {
      helper.unloadAgent(agent)
    })

    const txns = []
    for (let i = 0; i < numTxs; i++) {
      helper.runInTransaction(agent, (txn) => {
        txns.push(txn)
        txn.end()
      })
    }

    const sampledRatio = txns.filter((tx) => tx.sampled).length / numTxs

    plan.ok(sampledRatio > RATIO_VALUE - ERROR_MARGIN && sampledRatio < RATIO_VALUE + ERROR_MARGIN, `should sample approximately ${RATIO_VALUE * 100}% of traces, got ${sampledRatio * 100}%`)
    await plan.completed
  })
})
