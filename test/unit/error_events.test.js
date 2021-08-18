/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test

const helper = require('../lib/agent_helper')
const Exception = require('../../lib/errors').Exception

test('Error events', (t) => {
  t.autoend()

  t.test('when error events are disabled', (t) => {
    let agent

    t.beforeEach(() => {
      agent = helper.loadMockedAgent()
    })

    t.afterEach(() => {
      helper.unloadAgent(agent)
    })

    t.test('collector can override', (t) => {
      agent.config.error_collector.capture_events = false
      t.doesNotThrow(() => agent.config.onConnect({ 'error_collector.capture_events': true }))
      t.equal(agent.config.error_collector.capture_events, true)

      t.end()
    })

    t.end()
  })

  t.test('attributes', (t) => {
    let agent

    t.beforeEach(() => {
      agent = helper.loadMockedAgent()
    })

    t.afterEach(() => {
      helper.unloadAgent(agent)
    })

    t.test('should include DT intrinsics', (t) => {
      agent.config.distributed_tracing.enabled = true
      agent.config.primary_application_id = 'test'
      agent.config.account_id = 1
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

        t.equal(attributes.type, 'TransactionError')
        t.equal(attributes.traceId, tx.traceId)
        t.equal(attributes.guid, tx.id)
        t.equal(attributes.priority, tx.priority)
        t.equal(attributes.sampled, tx.sampled)
        t.equal(attributes['parent.type'], 'App')
        t.equal(attributes['parent.app'], agent.config.primary_application_id)
        t.equal(attributes['parent.account'], agent.config.account_id)
        t.equal(attributes['nr.transactionGuid'], tx.id)
        t.notOk(attributes.parentId)
        t.notOk(attributes.parentSpanId)

        t.end()
      })
    })

    t.test('should include spanId agent attribute', (t) => {
      agent.config.distributed_tracing.enabled = true
      agent.config.primary_application_id = 'test'
      agent.config.account_id = 1
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

        t.equal(agentAttributes.spanId, segment.id)

        t.end()
      })
    })

    t.test('should have the expected priority', (t) => {
      agent.config.distributed_tracing.enabled = true
      agent.config.primary_application_id = 'test'
      agent.config.account_id = 1
      helper.runInTransaction(agent, function (tx) {
        const error = new Error('some error')
        const customAttributes = {}
        const timestamp = 0
        const exception = new Exception({ error, customAttributes, timestamp })
        tx.addException(exception)
        tx.end()
        const attributes = agent.errors.eventAggregator.getEvents()[0][0]

        t.equal(attributes.type, 'TransactionError')
        t.equal(attributes.traceId, tx.traceId)
        t.equal(attributes.guid, tx.id)
        t.equal(attributes.priority, tx.priority)
        t.equal(attributes.sampled, tx.sampled)
        t.equal(attributes['nr.transactionGuid'], tx.id)
        t.ok(tx.priority > 1)
        t.equal(tx.sampled, true)

        t.end()
      })
    })

    t.end()
  })

  t.test('when error events are enabled', (t) => {
    let agent

    t.beforeEach(() => {
      agent = helper.loadMockedAgent()
      agent.config.error_collector.capture_events = true
    })

    t.afterEach(() => {
      helper.unloadAgent(agent)
    })

    t.test('collector can override', (t) => {
      t.doesNotThrow(() => agent.config.onConnect({ 'error_collector.capture_events': false }))
      t.equal(agent.config.error_collector.capture_events, false)

      t.end()
    })

    t.test('collector can disable using the emergency shut off', (t) => {
      t.doesNotThrow(() => agent.config.onConnect({ collect_error_events: false }))
      t.equal(agent.config.error_collector.capture_events, false)

      t.end()
    })

    t.test('collector cannot enable using the emergency shut off', (t) => {
      agent.config.error_collector.capture_events = false
      t.doesNotThrow(() => agent.config.onConnect({ collect_error_events: true }))
      t.equal(agent.config.error_collector.capture_events, false)

      t.end()
    })

    t.end()
  })
})
