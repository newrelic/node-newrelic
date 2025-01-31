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
