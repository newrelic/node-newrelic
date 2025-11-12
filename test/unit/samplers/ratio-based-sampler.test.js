/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO: more tests

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
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
  const sampler = new TraceIdRatioBasedSampler({ agent: t.nr.agent, ratio })
  const iterations = 10000
  let sampledCount = 0

  for (let i = 0; i < iterations; i++) {
    if (sampler.shouldSample(generateRandomTraceId())) {
      sampledCount++
    }
  }

  const actualRatio = sampledCount / iterations
  // Allow 1% margin of error
  assert.ok(actualRatio > ratio - 0.01 && actualRatio < ratio + 0.01)
})

// TODO: applySamplingDecision

function generateRandomTraceId() {
  return hashes.makeId(32)
}
