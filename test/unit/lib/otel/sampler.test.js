/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('#testlib/agent_helper.js')
const otel = require('@opentelemetry/api')
const NewRelicSampler = require('#agentlib/otel/sampler.js')
const { SpanKind } = require('@opentelemetry/api')
const sinon = require('sinon')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent({
    feature_flag: {
      opentelemetry_bridge: true
    }
  })

  const getSpanContextStub = sinon.stub(otel.trace, 'getSpanContext')
  const sampler = new NewRelicSampler()

  ctx.nr = { agent, getSpanContextStub, sampler }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.getSpanContextStub.restore()
})

test('should sample if transaction is active', (t) => {
  const { sampler } = t.nr
  const ctx = { transaction: { isActive() { return true } } }
  const result = sampler.shouldSample(ctx)
  assert.deepEqual(result, { decision: 2 })
})

test('should sample if context has `isRemote`', (t) => {
  const { getSpanContextStub, sampler } = t.nr
  getSpanContextStub.returns({ isRemote: true })
  const result = sampler.shouldSample({})
  assert.deepEqual(result, { decision: 2 })
})

;['server', 'consumer'].forEach((kind) => {
  test(`should sample if span kind is ${kind}`, (t) => {
    const { sampler } = t.nr
    const result = sampler.shouldSample({}, 'id', 'test-span', SpanKind[kind.toUpperCase()])
    assert.deepEqual(result, { decision: 2 })
  })
})

test('should not sample if no active transaction and kind is not server or consumer nor span isRemote', (t) => {
  const { getSpanContextStub, sampler } = t.nr
  const ctx = { transaction: { isActive() { return false } } }
  getSpanContextStub.returns({ isRemote: false })
  const result = sampler.shouldSample(ctx, 'id', 'test-span', SpanKind.CLIENT)
  assert.deepEqual(result, { decision: 0 })
})

test('should not sample if context undefined and no parent context', (t) => {
  const { sampler } = t.nr
  const result = sampler.shouldSample()
  assert.deepEqual(result, { decision: 0 })
})

test('should return proper string representation of sampler class', (t) => {
  const { sampler } = t.nr
  const value = sampler.toString()
  assert.equal(value, 'NrSampler')
})
