/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const helper = require('#testlib/agent_helper.js')
const hashes = require('#agentlib/util/hashes.js')
const { propagateTraceContext } = require('#agentlib/otel/segments/utils.js')

test.beforeEach((ctx) => {
  const agent = helper.loadMockedAgent()
  const transaction = {
    acceptTraceContextPayload: sinon.stub()
  }
  ctx.nr = {
    agent,
    transaction,
    traceId: hashes.makeId(32),
    parentId: hashes.makeId()
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should accept traceparent when span has parentSpanId', (t) => {
  const { transaction, parentId, traceId } = t.nr
  const otelSpan = {
    parentSpanId: parentId,
    spanContext() {
      return {
        traceId,
        traceFlags: 1,
        traceState: { state: 'state' }
      }
    }
  }
  propagateTraceContext({ transaction, otelSpan, transport: 'transport' })
  assert.equal(transaction.acceptTraceContextPayload.callCount, 1)
  assert.deepEqual(transaction.acceptTraceContextPayload.args[0], [
    `00-${traceId}-${parentId}-01`, 'state', 'transport'
  ])
})

test('should accept traceparent when span has parentSpanContext.spanId', (t) => {
  const { transaction, parentId, traceId } = t.nr
  const otelSpan = {
    parentSpanContext: { spanId: parentId },
    spanContext() {
      return {
        traceId,
        traceFlags: 1,
        traceState: { state: 'state' }
      }
    }
  }
  propagateTraceContext({ transaction, otelSpan, transport: 'transport' })
  assert.equal(transaction.acceptTraceContextPayload.callCount, 1)
  assert.deepEqual(transaction.acceptTraceContextPayload.args[0], [
    `00-${traceId}-${parentId}-01`, 'state', 'transport'
  ])
})

test('should not accept traceparent when span has not parent span id', (t) => {
  const { transaction } = t.nr
  const otelSpan = { spanContext() { return {} } }
  propagateTraceContext({ transaction, otelSpan, transport: 'transport' })
  assert.equal(transaction.acceptTraceContextPayload.callCount, 0)
})
