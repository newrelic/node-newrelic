/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const hashes = require('#agentlib/util/hashes.js')
const TraceIdRatioBasedSampler = require('#agentlib/samplers/ratio-based-sampler.js')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent({})
})

test.afterEach((ctx) => {
  if (ctx.nr.agent) helper.unloadAgent(ctx.nr.agent)
})

test('should create a TraceIdRatioBasedSampler with the correct ratio', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ agent: t.nr.agent, ratio: 0.5 })
  assert.strictEqual(sampler._ratio, 0.5)
})

test('should normalize bad ratio, above bound', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ agent: t.nr.agent, ratio: 1.5 })
  assert.strictEqual(sampler._ratio, 1)
})

test('should normalize bad ratio, below bound', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ agent: t.nr.agent, ratio: -0.5 })
  assert.strictEqual(sampler._ratio, 0)
})

test('should default to 0 if ratio NaN', (t) => {
  const { agent } = t.nr
  const sampler = new TraceIdRatioBasedSampler({ agent, ratio: 'invalid' })
  assert.strictEqual(sampler._ratio, 0)
})

test('should always sample if ratio=1', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ agent: t.nr.agent, ratio: 1 })
  assert.strictEqual(sampler.shouldSample(generateRandomTraceId()), true)
})

test('should never sample if ratio=0', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ agent: t.nr.agent, ratio: 0 })
  assert.strictEqual(sampler.shouldSample(generateRandomTraceId()), false)
})

test('should accumulate trace ID correctly', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ agent: t.nr.agent, ratio: 0.5 })
  const traceId = '0'.repeat(32)
  const accumulated = sampler._accumulate(traceId)
  assert.strictEqual(accumulated, 0)
})

test('should sample consistently for same trace ID', (t) => {
  const sampler = new TraceIdRatioBasedSampler({ agent: t.nr.agent, ratio: 0.5 })
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
  const sampler = new TraceIdRatioBasedSampler({ agent: t.nr.agent, ratio })
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

test('should set `sampled` and `priority` correctly on sampled transaction', (t, end) => {
  t.nr.agent.samplers.root = new TraceIdRatioBasedSampler({ agent: t.nr.agent, ratio: 1 })
  helper.runInTransaction(t.nr.agent, (txn) => {
    txn.end()
    assert.strictEqual(txn.sampled, true)
    assert.ok(txn.priority > 1)
    end()
  })
})

test('should set `sampled` and `priority` correctly on not sampled transaction', (t, end) => {
  t.nr.agent.samplers.root = new TraceIdRatioBasedSampler({ agent: t.nr.agent, ratio: 0 })
  helper.runInTransaction(t.nr.agent, (txn) => {
    txn.end()
    assert.strictEqual(txn.sampled, false)
    assert.ok(txn.priority < 1)
    end()
  })
})

function generateRandomTraceId() {
  return hashes.makeId(32)
}
