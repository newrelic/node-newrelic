/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const Transaction = require('../../lib/transaction')
const helper = require('../lib/agent_helper')

const DESTS = require('../../lib/config/attribute-filter').DESTINATIONS
const LIMIT = 10

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent({
    transaction_events: { max_samples_stored: LIMIT }
  })
  ctx.nr.agent.config.attributes.enabled = true
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('when there are attributes on transaction', async (t) => {
  helper.unloadAgent(t.nr.agent)
  t.beforeEach((ctx) => {
    ctx.nr.trans = new Transaction(ctx.nr.agent)
  })

  await t.test('event should contain those attributes', (t) => {
    const { agent, trans } = t.nr
    trans.trace.attributes.addAttribute(DESTS.TRANS_EVENT, 'test', 'TEST')
    agent._addEventFromTransaction(trans)

    const first = 0
    const agentAttrs = 2

    const events = getTransactionEvents(agent)
    const firstEvent = events[first]
    assert.equal(firstEvent[agentAttrs].test, 'TEST')
  })
})

test('when host name is specified by user', async (t) => {
  helper.unloadAgent(t.nr.agent)
  t.beforeEach((ctx) => {
    ctx.nr.agent.config.process_host.display_name = 'test-value'
    ctx.nr.trans = new Transaction(ctx.nr.agent)
  })

  await t.test('name should be sent with event', (t) => {
    const { agent, trans } = t.nr
    agent._addEventFromTransaction(trans)

    const first = 0
    const agentAttrs = 2

    const events = getTransactionEvents(agent)
    const firstEvent = events[first]
    assert.deepEqual(firstEvent[agentAttrs], {
      'host.displayName': 'test-value'
    })
  })
})

test('when analytics events are disabled', async (t) => {
  helper.unloadAgent(t.nr.agent)

  await t.test('collector cannot enable remotely', (t) => {
    const { agent } = t.nr
    agent.config.transaction_events.enabled = false
    assert.doesNotThrow(function () {
      agent.config.onConnect({ collect_analytics_events: true })
    })
    assert.equal(agent.config.transaction_events.enabled, false)
  })
})

test('when analytics events are enabled', async (t) => {
  helper.unloadAgent(t.nr.agent)

  await t.test('collector can disable remotely', (t) => {
    const { agent } = t.nr
    agent.config.transaction_events.enabled = true
    assert.doesNotThrow(function () {
      agent.config.onConnect({ collect_analytics_events: false })
    })
    assert.equal(agent.config.transaction_events.enabled, false)
  })
})

test('on transaction finished', async (t) => {
  helper.unloadAgent(t.nr.agent)
  t.beforeEach((ctx) => {
    ctx.nr.trans = new Transaction(ctx.nr.agent)
  })

  await t.test('should queue an event', async (t) => {
    const { agent, trans } = t.nr
    agent._addEventFromTransaction = (transaction) => {
      assert.equal(transaction, trans)
      trans.end()
    }
  })

  await t.test('should generate an event from transaction', (t) => {
    const { agent, trans } = t.nr
    trans.end()

    const events = getTransactionEvents(agent)

    assert.equal(events.length, 1)

    const event = events[0]
    assert.ok(Array.isArray(event))
    const eventValues = event[0]
    assert.equal(typeof eventValues, 'object')
    assert.equal(typeof eventValues.webDuration, 'number')
    assert.equal(Number.isNaN(eventValues.webDuration), false)
    assert.equal(eventValues.webDuration, trans.timer.getDurationInMillis() / 1000)
    assert.equal(typeof eventValues.timestamp, 'number')
    assert.equal(Number.isNaN(eventValues.timestamp), false)
    assert.equal(eventValues.timestamp, trans.timer.start)
    assert.equal(eventValues.name, trans.name)
    assert.equal(eventValues.duration, trans.timer.getDurationInMillis() / 1000)
    assert.equal(eventValues.type, 'Transaction')
    assert.equal(eventValues.error, false)
  })

  await t.test('should flag errored transactions', (t) => {
    const { agent, trans } = t.nr
    trans.addException(new Error('wuh oh'))
    trans.end()

    const events = getTransactionEvents(agent)
    assert.equal(events.length, 1)

    const event = events[0]
    assert.ok(Array.isArray(event))
    const eventValues = event[0]
    assert.equal(typeof eventValues, 'object')
    assert.equal(typeof eventValues.webDuration, 'number')
    assert.equal(Number.isNaN(eventValues.webDuration), false)
    assert.equal(eventValues.webDuration, trans.timer.getDurationInMillis() / 1000)
    assert.equal(typeof eventValues.timestamp, 'number')
    assert.equal(Number.isNaN(eventValues.timestamp), false)
    assert.equal(eventValues.timestamp, trans.timer.start)
    assert.equal(eventValues.name, trans.name)
    assert.equal(eventValues.duration, trans.timer.getDurationInMillis() / 1000)
    assert.equal(eventValues.type, 'Transaction')
    assert.equal(eventValues.error, true)
  })

  await t.test('should add DT parent attributes with an accepted payload', (t) => {
    const { agent } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.distributed_tracing.primary_application_id = 'test'
    agent.config.distributed_tracing.account_id = 1
    const trans = new Transaction(agent)
    const payload = trans._createDistributedTracePayload().text()
    trans.isDistributedTrace = null
    trans._acceptDistributedTracePayload(payload)
    trans.end()

    const events = getTransactionEvents(agent)

    assert.equal(events.length, 1)

    const attributes = events[0][0]
    assert.equal(attributes.traceId, trans.traceId)
    assert.equal(attributes.guid, trans.id)
    assert.equal(attributes.priority, trans.priority)
    assert.equal(attributes.sampled, trans.sampled)
    assert.equal(attributes.parentId, trans.id)
    assert.equal(attributes['parent.type'], 'App')
    assert.equal(attributes['parent.app'], agent.config.distributed_tracing.primary_application_id)
    assert.equal(attributes['parent.account'], agent.config.distributed_tracing.account_id)
    assert.equal(attributes.error, false)
    assert.equal(trans.sampled, true)
    assert.ok(trans.priority > 1)
  })

  await t.test('should add DT attributes', (t) => {
    const { agent } = t.nr
    agent.config.distributed_tracing.enabled = true
    const trans = new Transaction(agent)
    trans.end()

    const events = getTransactionEvents(agent)

    assert.equal(events.length, 1)

    const attributes = events[0][0]
    assert.equal(attributes.traceId, trans.traceId)
    assert.equal(attributes.guid, trans.id)
    assert.equal(attributes.priority, trans.priority)
    assert.equal(attributes.sampled, trans.sampled)
    assert.equal(trans.sampled, true)
    assert.ok(trans.priority > 1)
  })

  await t.test('should contain user and agent attributes', (t) => {
    const { agent, trans } = t.nr
    trans.end()

    const events = getTransactionEvents(agent)

    assert.equal(events.length, 1)

    const event = events[0]
    assert.equal(typeof event[0], 'object')
    assert.equal(typeof event[1], 'object')
    assert.equal(typeof event[2], 'object')
  })

  await t.test('should contain custom attributes', (t) => {
    const { agent, trans } = t.nr
    trans.trace.addCustomAttribute('a', 'b')
    trans.end()

    const events = getTransactionEvents(agent)
    const event = events[0]
    assert.equal(event[1].a, 'b')
  })

  await t.test('includes internal synthetics attributes', (t) => {
    const { agent, trans } = t.nr
    trans.syntheticsData = {
      version: 1,
      accountId: 123,
      resourceId: 'resId',
      jobId: 'jobId',
      monitorId: 'monId'
    }

    trans.syntheticsInfoData = {
      version: 1,
      type: 'unitTest',
      initiator: 'cli',
      attributes: {
        'Attr-Test': 'value',
        attr2Test: 'value1',
        'xTest-Header': 'value2'
      }
    }

    trans.end()

    const events = getTransactionEvents(agent)
    const event = events[0]
    const attributes = event[0]
    assert.equal(attributes['nr.syntheticsResourceId'], 'resId')
    assert.equal(attributes['nr.syntheticsJobId'], 'jobId')
    assert.equal(attributes['nr.syntheticsMonitorId'], 'monId')
    assert.equal(attributes['nr.syntheticsType'], 'unitTest')
    assert.equal(attributes['nr.syntheticsInitiator'], 'cli')
    assert.equal(attributes['nr.syntheticsAttrTest'], 'value')
    assert.equal(attributes['nr.syntheticsAttr2Test'], 'value1')
    assert.equal(attributes['nr.syntheticsXTestHeader'], 'value2')
  })

  await t.test('not spill over reservoir size', (t) => {
    const { agent, trans } = t.nr
    for (let i = 0; i < 20; i++) {
      agent._addEventFromTransaction(trans)
    }
    assert.equal(getTransactionEvents(agent).length, LIMIT)
  })
})

function getTransactionEvents(agent) {
  return agent.transactionEventAggregator.getEvents()
}
