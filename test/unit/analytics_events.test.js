/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const Transaction = require('../../lib/transaction')
const helper = require('../lib/agent_helper')

const DESTS = require('../../lib/config/attribute-filter').DESTINATIONS

const LIMIT = 10

tap.test('Analytics events', function (t) {
  t.autoend()

  let agent = null
  let trans = null

  t.beforeEach(function () {
    if (agent) {
      return
    } // already instantiated
    agent = helper.loadMockedAgent({
      transaction_events: {
        max_samples_stored: LIMIT
      }
    })
    agent.config.attributes.enabled = true
  })

  t.afterEach(function () {
    if (!agent) {
      return
    } // already destroyed
    helper.unloadAgent(agent)
    agent = null
  })

  t.test('when there are attributes on transaction', function (t) {
    t.autoend()

    t.beforeEach(function () {
      trans = new Transaction(agent)
    })

    t.test('event should contain those attributes', function (t) {
      trans.trace.attributes.addAttribute(DESTS.TRANS_EVENT, 'test', 'TEST')
      agent._addEventFromTransaction(trans)

      const first = 0
      const agentAttrs = 2

      const events = getTransactionEvents(agent)
      const firstEvent = events[first]
      t.equal(firstEvent[agentAttrs].test, 'TEST')
      t.end()
    })
  })

  t.test('when host name is specified by user', function (t) {
    t.autoend()

    t.beforeEach(function () {
      agent.config.process_host.display_name = 'test-value'
      trans = new Transaction(agent)
    })

    t.test('name should be sent with event', function (t) {
      agent._addEventFromTransaction(trans)

      const first = 0
      const agentAttrs = 2

      const events = getTransactionEvents(agent)
      const firstEvent = events[first]
      t.same(firstEvent[agentAttrs], {
        'host.displayName': 'test-value'
      })
      t.end()
    })
  })

  t.test('when analytics events are disabled', function (t) {
    t.autoend()

    t.test('collector cannot enable remotely', function (t) {
      agent.config.transaction_events.enabled = false
      t.doesNotThrow(function () {
        agent.config.onConnect({ collect_analytics_events: true })
      })
      t.equal(agent.config.transaction_events.enabled, false)
      t.end()
    })
  })

  t.test('when analytics events are enabled', function (t) {
    t.autoend()

    t.test('collector can disable remotely', function (t) {
      agent.config.transaction_events.enabled = true
      t.doesNotThrow(function () {
        agent.config.onConnect({ collect_analytics_events: false })
      })
      t.equal(agent.config.transaction_events.enabled, false)
      t.end()
    })
  })

  t.test('on transaction finished', function (t) {
    t.autoend()

    t.beforeEach(function () {
      trans = new Transaction(agent)
    })

    t.test('should queue an event', async function (t) {
      agent._addEventFromTransaction = (transaction) => {
        t.equal(transaction, trans)
        trans.end()
        t.end()
      }
    })

    t.test('should generate an event from transaction', function (t) {
      trans.end()

      const events = getTransactionEvents(agent)

      t.equal(events.length, 1)

      const event = events[0]
      t.ok(Array.isArray(event))
      const eventValues = event[0]
      t.equal(typeof eventValues, 'object')
      t.equal(typeof eventValues.webDuration, 'number')
      t.not(Number.isNaN(eventValues.webDuration))
      t.equal(eventValues.webDuration, trans.timer.getDurationInMillis() / 1000)
      t.equal(typeof eventValues.timestamp, 'number')
      t.not(Number.isNaN(eventValues.timestamp))
      t.equal(eventValues.timestamp, trans.timer.start)
      t.equal(eventValues.name, trans.name)
      t.equal(eventValues.duration, trans.timer.getDurationInMillis() / 1000)
      t.equal(eventValues.type, 'Transaction')
      t.equal(eventValues.error, false)
      t.end()
    })

    t.test('should flag errored transactions', function (t) {
      trans.addException(new Error('wuh oh'))
      trans.end()

      const events = getTransactionEvents(agent)
      t.equal(events.length, 1)

      const event = events[0]
      t.ok(Array.isArray(event))
      const eventValues = event[0]
      t.equal(typeof eventValues, 'object')
      t.equal(typeof eventValues.webDuration, 'number')
      t.not(Number.isNaN(eventValues.webDuration))
      t.equal(eventValues.webDuration, trans.timer.getDurationInMillis() / 1000)
      t.equal(typeof eventValues.timestamp, 'number')
      t.not(Number.isNaN(eventValues.timestamp))
      t.equal(eventValues.timestamp, trans.timer.start)
      t.equal(eventValues.name, trans.name)
      t.equal(eventValues.duration, trans.timer.getDurationInMillis() / 1000)
      t.equal(eventValues.type, 'Transaction')
      t.equal(eventValues.error, true)
      t.end()
    })

    t.test('should add DT parent attributes with an accepted payload', function (t) {
      agent.config.distributed_tracing.enabled = true
      agent.config.primary_application_id = 'test'
      agent.config.account_id = 1
      trans = new Transaction(agent)
      const payload = trans._createDistributedTracePayload().text()
      trans.isDistributedTrace = null
      trans._acceptDistributedTracePayload(payload)
      trans.end()

      const events = getTransactionEvents(agent)

      t.equal(events.length, 1)

      const attributes = events[0][0]
      t.equal(attributes.traceId, trans.traceId)
      t.equal(attributes.guid, trans.id)
      t.equal(attributes.priority, trans.priority)
      t.equal(attributes.sampled, trans.sampled)
      t.equal(attributes.parentId, trans.id)
      t.equal(attributes['parent.type'], 'App')
      t.equal(attributes['parent.app'], agent.config.primary_application_id)
      t.equal(attributes['parent.account'], agent.config.account_id)
      t.equal(attributes.error, false)
      t.equal(trans.sampled, true)
      t.ok(trans.priority > 1)
      t.end()
    })

    t.test('should add DT attributes', function (t) {
      agent.config.distributed_tracing.enabled = true
      trans = new Transaction(agent)
      trans.end()

      const events = getTransactionEvents(agent)

      t.equal(events.length, 1)

      const attributes = events[0][0]
      t.equal(attributes.traceId, trans.traceId)
      t.equal(attributes.guid, trans.id)
      t.equal(attributes.priority, trans.priority)
      t.equal(attributes.sampled, trans.sampled)
      t.equal(trans.sampled, true)
      t.ok(trans.priority > 1)
      t.end()
    })

    t.test('should contain user and agent attributes', function (t) {
      trans.end()

      const events = getTransactionEvents(agent)

      t.equal(events.length, 1)

      const event = events[0]
      t.equal(typeof event[0], 'object')
      t.equal(typeof event[1], 'object')
      t.equal(typeof event[2], 'object')
      t.end()
    })

    t.test('should contain custom attributes', function (t) {
      trans.trace.addCustomAttribute('a', 'b')
      trans.end()

      const events = getTransactionEvents(agent)
      const event = events[0]
      t.equal(event[1].a, 'b')
      t.end()
    })

    t.test('includes internal synthetics attributes', function (t) {
      trans.syntheticsData = {
        version: 1,
        accountId: 123,
        resourceId: 'resId',
        jobId: 'jobId',
        monitorId: 'monId'
      }

      trans.end()

      const events = getTransactionEvents(agent)
      const event = events[0]
      const attributes = event[0]
      t.equal(attributes['nr.syntheticsResourceId'], 'resId')
      t.equal(attributes['nr.syntheticsJobId'], 'jobId')
      t.equal(attributes['nr.syntheticsMonitorId'], 'monId')
      t.end()
    })

    t.test('not spill over reservoir size', function (t) {
      for (let i = 0; i < 20; i++) {
        agent._addEventFromTransaction(trans)
      }
      t.equal(getTransactionEvents(agent).length, LIMIT)
      t.end()
    })
  })
})

function getTransactionEvents(agent) {
  return agent.transactionEventAggregator.getEvents()
}
