/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../../lib/agent_helper')
const otel = require('@opentelemetry/api')
const { otelSynthesis } = require('../../../../lib/symbols')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent({
    feature_flag: {
      opentelemetry_bridge: true
    },
    opentelemetry: {
      bridge: { enabled: true },
      traces: { enabled: true }
    }
  })
  ctx.nr = { agent }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should give root context', () => {
  const ctx = otel.context.active()
  assert.equal(ctx._transaction, undefined)
  assert.equal(ctx._segment, undefined)
  assert.equal(ctx._otelCtx.size, 0)
})

test('should get proper context', (t, end) => {
  const key = otel.createContextKey('test-key')
  const ctx = otel.context.active()
  const newCtx = 'new-ctx'
  otel.context.with(ctx.setValue(key, newCtx), async() => {
    const activeCtx = otel.context.active()
    const data = activeCtx.getValue(key)
    assert.equal(data, newCtx)
    end()
  })
})

test('should delete value from context', () => {
  const key = otel.createContextKey('test-key')
  const key2 = otel.createContextKey('test-key-2')
  const ctx = otel.context.active()
  const newCtx = ctx.setValue(key, 'new-ctx')
  const thirdCtx = newCtx.setValue(key2, 'ctx-2')
  const finalCtx = thirdCtx.deleteValue(key2)
  assert.ok(finalCtx.getValue(key))
  assert.ok(!finalCtx.getValue(key2))
})

test('should remove otelSynthesis symbol when it exists on value', () => {
  const key = otel.createContextKey('test-key')
  const ctx = otel.context.active()
  const nrCtx = {
    segment: {
      start() {},
      name: 'test'
    },
    transaction: { id: 'id' }
  }
  const ctxData = { [otelSynthesis]: nrCtx }
  ctxData.test = 'value'
  const newCtx = ctx.setValue(key, ctxData)
  assert.deepEqual(newCtx._transaction, nrCtx.transaction)
  assert.deepEqual(newCtx._segment, nrCtx.segment)
  assert.ok(!newCtx[otelSynthesis])
  const otelData = newCtx.getValue(key)
  assert.deepEqual(otelData, { test: 'value' })
})

test('should add transaction and trace root to otel ctx', (t) => {
  const { agent } = t.nr
  const ctx = otel.context.active()
  const transaction = { agent, traceId: 'traceId', trace: { root: { id: 'segmentId' } } }
  const newContext = ctx.enterTransaction(transaction)
  const fakeSpan = newContext.getValue(agent.otelSpanKey)
  assert.deepEqual(fakeSpan, {
    segmentId: transaction.trace.root.id,
    traceId: transaction.traceId
  })
})

test('should not add transaction and trace root to otel ctx when undefined', (t) => {
  const { agent } = t.nr
  const ctx = otel.context.active()
  const newContext = ctx.enterTransaction()
  const fakeSpan = newContext.getValue(agent.otelSpanKey)
  assert.equal(fakeSpan, undefined)
})

test('should add segment to otel ctx', (t) => {
  const { agent } = t.nr
  const ctx = otel.context.active()
  ctx._transaction = { agent, traceId: 'traceId' }
  const segment = { id: 'segmentId' }
  const newContext = ctx.enterSegment({ segment })
  const fakeSpan = newContext.getValue(agent.otelSpanKey)
  assert.deepEqual(fakeSpan, {
    segmentId: segment.id,
    traceId: newContext.transaction.traceId
  })
})

test('should not error if missing segment', (t) => {
  const { agent } = t.nr
  const ctx = otel.context.active()
  ctx._transaction = { agent, traceId: 'traceId' }
  const newContext = ctx.enterSegment({})
  assert.ok(newContext)
})

test('should add segment to otel when both segment and transaction are passed in', (t) => {
  const { agent } = t.nr
  const ctx = otel.context.active()
  const transaction = { agent, traceId: 'traceId' }
  const segment = { id: 'segmentId' }
  const newContext = ctx.enterSegment({ segment, transaction })
  const fakeSpan = newContext.getValue(agent.otelSpanKey)
  assert.deepEqual(fakeSpan, {
    segmentId: segment.id,
    traceId: newContext.transaction.traceId
  })
})

test('should not set fake span if transaction.agent.otelSpanKey is null', (t) => {
  const { agent } = t.nr
  const ctx = otel.context.active()
  const segment = { id: 'segmentId' }
  const newContext = ctx.enterSegment({ segment })
  const fakeSpan = newContext.getValue(agent.otelSpanKey)
  assert.equal(fakeSpan, undefined)
})
