/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const Transaction = require('../../../lib/transaction')

function getErrorTraces(errorCollector) {
  return errorCollector.traceAggregator.errors
}

function getErrorEvents(errorCollector) {
  return errorCollector.eventAggregator.getEvents()
}

tap.test('Error Group functionality', (t) => {
  t.autoend()
  let agent = null

  t.beforeEach(() => {
    if (agent) {
      helper.unloadAgent(agent)
    }
    agent = helper.loadMockedAgent({
      attributes: {
        enabled: true
      }
    })
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should set error.group.name attribute when callback is set', (t) => {
    const myCallback = function myCallback() {
      return 'error-group-test-1'
    }
    agent.errors.errorGroupCallback = myCallback

    const error = new Error('whoops')
    const transaction = new Transaction(agent)
    agent.errors.add(transaction, error)
    agent.errors.onTransactionFinished(transaction)

    const errorTraces = getErrorTraces(agent.errors)
    const errorEvents = getErrorEvents(agent.errors)

    t.same(errorTraces[0][4].agentAttributes, { 'error.group.name': 'error-group-test-1' })
    t.same(errorEvents[0][2], { 'error.group.name': 'error-group-test-1' })

    t.end()
  })

  t.test('should not set error.group.name attribute when callback throws', (t) => {
    const myCallback = function myCallback() {
      throw new Error('boom')
    }
    agent.errors.errorGroupCallback = myCallback

    const error = new Error('whoops')
    const transaction = new Transaction(agent)
    agent.errors.add(transaction, error)
    agent.errors.onTransactionFinished(transaction)

    const errorTraces = getErrorTraces(agent.errors)
    const errorEvents = getErrorEvents(agent.errors)

    t.same(errorTraces[0][4].agentAttributes, {})
    t.same(errorEvents[0][2], {})

    t.end()
  })

  t.test('should not set error.group.name attribute when callback returns empty string', (t) => {
    const myCallback = function myCallback() {
      return ''
    }
    agent.errors.errorGroupCallback = myCallback

    const error = new Error('whoops')
    const transaction = new Transaction(agent)
    agent.errors.add(transaction, error)
    agent.errors.onTransactionFinished(transaction)

    const errorTraces = getErrorTraces(agent.errors)
    const errorEvents = getErrorEvents(agent.errors)

    t.same(errorTraces[0][4].agentAttributes, {})
    t.same(errorEvents[0][2], {})

    t.end()
  })

  t.test('should not set error.group.name attribute when callback returns not a string', (t) => {
    const myCallback = function myCallback() {
      return { 'error.group.name': 'blah' }
    }
    agent.errors.errorGroupCallback = myCallback

    const error = new Error('whoops')
    const transaction = new Transaction(agent)
    agent.errors.add(transaction, error)
    agent.errors.onTransactionFinished(transaction)

    const errorTraces = getErrorTraces(agent.errors)
    const errorEvents = getErrorEvents(agent.errors)

    t.same(errorTraces[0][4].agentAttributes, {})
    t.same(errorEvents[0][2], {})

    t.end()
  })
})
