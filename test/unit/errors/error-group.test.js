/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const Transaction = require('../../../lib/transaction')

test('Error Group functionality', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({ attributes: { enabled: true } })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should set error.group.name attribute when callback is set', (t) => {
    const { agent } = t.nr
    agent.errors.errorGroupCallback = myCallback

    const error = Error('whoops')
    const tx = new Transaction(agent)
    agent.errors.add(tx, error)
    agent.errors.onTransactionFinished(tx)

    const errorTraces = getErrorTraces(agent.errors)
    const errorEvents = getErrorEvents(agent.errors)
    assert.deepEqual(errorTraces[0][4].agentAttributes, {
      'error.group.name': 'error-group-test-1'
    })
    assert.deepEqual(errorEvents[0][2], { 'error.group.name': 'error-group-test-1' })

    function myCallback() {
      return 'error-group-test-1'
    }
  })

  await t.test('should not set error.group.name attribute when callback throws', (t) => {
    const { agent } = t.nr
    agent.errors.errorGroupCallback = myCallback

    const error = Error('whoops')
    const tx = new Transaction(agent)
    agent.errors.add(tx, error)
    agent.errors.onTransactionFinished(tx)

    const errorTraces = getErrorTraces(agent.errors)
    const errorEvents = getErrorEvents(agent.errors)
    assert.deepEqual(errorTraces[0][4].agentAttributes, {})
    assert.deepEqual(errorEvents[0][2], {})

    function myCallback() {
      throw Error('boom')
    }
  })

  await t.test(
    'should not set error.group.name attribute when callback returns empty string',
    (t) => {
      const { agent } = t.nr
      agent.errors.errorGroupCallback = myCallback

      const error = Error('whoops')
      const tx = new Transaction(agent)
      agent.errors.add(tx, error)
      agent.errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(agent.errors)
      const errorEvents = getErrorEvents(agent.errors)
      assert.deepEqual(errorTraces[0][4].agentAttributes, {})
      assert.deepEqual(errorEvents[0][2], {})

      function myCallback() {
        return ''
      }
    }
  )

  await t.test(
    'should not set error.group.name attribute when callback returns not a string',
    (t) => {
      const { agent } = t.nr
      agent.errors.errorGroupCallback = myCallback

      const error = Error('whoops')
      const tx = new Transaction(agent)
      agent.errors.add(tx, error)
      agent.errors.onTransactionFinished(tx)

      const errorTraces = getErrorTraces(agent.errors)
      const errorEvents = getErrorEvents(agent.errors)
      assert.deepEqual(errorTraces[0][4].agentAttributes, {})
      assert.deepEqual(errorEvents[0][2], {})

      function myCallback() {
        return { 'error.group.name': 'blah' }
      }
    }
  )
})

function getErrorTraces(errorCollector) {
  return errorCollector.traceAggregator.errors
}

function getErrorEvents(errorCollector) {
  return errorCollector.eventAggregator.getEvents()
}
