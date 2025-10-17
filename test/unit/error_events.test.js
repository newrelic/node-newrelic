/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../lib/agent_helper')
const { Exception } = require('../../lib/errors')

test('when error events are disabled', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('collector can override', (t) => {
    const { agent } = t.nr
    agent.config.error_collector.capture_events = false
    assert.doesNotThrow(() => agent.config.onConnect({
      'error_collector.capture_events': true,
      'error_collector.max_event_samples_stored': 42
    }))
    assert.equal(agent.config.error_collector.capture_events, true)
    assert.equal(agent.config.error_collector.max_event_samples_stored, 42)
  })
})

test('attributes', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should include DT intrinsics', (t, end) => {
    const { agent } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.distributed_tracing.primary_application_id = 'test'
    agent.config.distributed_tracing.account_id = 1
    helper.runInTransaction(agent, function (tx) {
      const payload = tx._createDistributedTracePayload().text()
      tx.isDistributedTrace = null
      tx._acceptDistributedTracePayload(payload)
      const error = new Error('some error')
      const customAttributes = {}
      const timestamp = 0
      const exception = new Exception({ error, customAttributes, timestamp })
      tx.addException(exception)

      tx.end()
      const attributes = agent.errors.eventAggregator.getEvents()[0][0]

      assert.equal(attributes.type, 'TransactionError')
      assert.equal(attributes.traceId, tx.traceId)
      assert.equal(attributes.guid, tx.id)
      assert.equal(attributes.priority, tx.priority)
      assert.equal(attributes.sampled, tx.sampled)
      assert.equal(attributes['parent.type'], 'App')
      assert.equal(attributes['parent.app'], agent.config.distributed_tracing.primary_application_id)
      assert.equal(attributes['parent.account'], agent.config.distributed_tracing.account_id)
      assert.equal(attributes['nr.transactionGuid'], tx.id)
      assert.equal(attributes.parentId, undefined)
      assert.equal(attributes.parentSpanId, undefined)

      end()
    })
  })

  await t.test('should include spanId agent attribute', (t, end) => {
    const { agent } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.distributed_tracing.primary_application_id = 'test'
    agent.config.distributed_tracing.account_id = 1
    helper.runInTransaction(agent, function (tx) {
      const payload = tx._createDistributedTracePayload().text()
      tx.isDistributedTrace = null
      tx._acceptDistributedTracePayload(payload)
      const error = new Error('some error')
      const customAttributes = {}
      const timestamp = 0
      const exception = new Exception({ error, customAttributes, timestamp })
      tx.addException(exception)

      const segment = tx.agent.tracer.getSegment()

      tx.end()

      const { 2: agentAttributes } = agent.errors.eventAggregator.getEvents()[0]

      assert.equal(agentAttributes.spanId, segment.id)

      end()
    })
  })

  await t.test('should have the expected priority', (t, end) => {
    const { agent } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.distributed_tracing.primary_application_id = 'test'
    agent.config.distributed_tracing.account_id = 1
    helper.runInTransaction(agent, function (tx) {
      const error = new Error('some error')
      const customAttributes = {}
      const timestamp = 0
      const exception = new Exception({ error, customAttributes, timestamp })
      tx.addException(exception)
      tx.end()
      const attributes = agent.errors.eventAggregator.getEvents()[0][0]

      assert.equal(attributes.type, 'TransactionError')
      assert.equal(attributes.traceId, tx.traceId)
      assert.equal(attributes.guid, tx.id)
      assert.equal(attributes.priority, tx.priority)
      assert.equal(attributes.sampled, tx.sampled)
      assert.equal(attributes['nr.transactionGuid'], tx.id)
      assert.ok(tx.priority > 1)
      assert.equal(tx.sampled, true)

      end()
    })
  })
})

test('attributes', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
    ctx.nr.agent.config.error_collector.capture_events = true
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('collector can override', (t) => {
    const { agent } = t.nr
    assert.doesNotThrow(() => agent.config.onConnect({ 'error_collector.capture_events': false }))
    assert.equal(agent.config.error_collector.capture_events, false)
  })

  await t.test('collector can disable using the emergency shut off', (t) => {
    const { agent } = t.nr
    assert.doesNotThrow(() => agent.config.onConnect({ collect_error_events: false }))
    assert.equal(agent.config.error_collector.capture_events, false)
  })

  await t.test('collector cannot enable using the emergency shut off', (t) => {
    const { agent } = t.nr
    agent.config.error_collector.capture_events = false
    assert.doesNotThrow(() => agent.config.onConnect({ collect_error_events: true }))
    assert.equal(agent.config.error_collector.capture_events, false)
  })
})
