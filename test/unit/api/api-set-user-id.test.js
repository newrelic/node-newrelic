/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const sinon = require('sinon')
const proxyquire = require('proxyquire')
const loggerMock = require('../mocks/logger')()

const helper = require('../../lib/agent_helper')
const API = proxyquire('../../../api', {
  './lib/logger': {
    child: sinon.stub().callsFake(() => loggerMock)
  }
})
const { createError, Exception } = require('../../../lib/errors')
const { DESTINATIONS } = require('../../../lib/config/attribute-filter')

tap.test('Agent API = set user id', (t) => {
  t.autoend()
  let agent = null
  let api

  t.beforeEach(() => {
    loggerMock.warn.reset()
    agent = helper.loadMockedAgent({
      attributes: {
        enabled: true
      }
    })
    api = new API(agent)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should have a setUserID method', (t) => {
    t.ok(api.setUserID)
    t.equal(typeof api.setUserID, 'function', 'api.setUserID should be a function')
    t.end()
  })

  t.test('should set the enduser.id on transaction attributes', (t) => {
    const id = 'anonymizedUser123456'
    helper.runInTransaction(agent, (tx) => {
      api.setUserID(id)
      t.equal(loggerMock.warn.callCount, 0, 'should not log warnings when setUserID succeeds')
      const attrs = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      t.equal(attrs['enduser.id'], id, 'should set enduser.id attribute on transaction')
      const traceAttrs = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      t.equal(traceAttrs['enduser.id'], id, 'should set enduser.id attribute on transaction')
      t.end()
    })
  })

  t.test('should set enduser.id attribute on error event when in a transaction', (t) => {
    const id = 'anonymizedUser567890'
    helper.runInTransaction(agent, (tx) => {
      api.setUserID(id)
      const exception = new Exception(new Error('Test error.'))
      const [...data] = createError(tx, exception, agent.config)
      const params = data.pop()
      t.equal(params.agentAttributes['enduser.id'], id, 'should set enduser.id attribute on error')
      t.end()
    })
  })

  const WARN_MSG =
    'User id is empty or not in a transaction, not assigning `enduser.id` attribute to transaction events, trace events, and/or errors.'

  const emptyOptions = [null, undefined, '']
  emptyOptions.forEach((value) => {
    t.test(`should not assign enduser.id if id is '${value}'`, (t) => {
      api.setUserID(value)
      t.equal(loggerMock.warn.callCount, 1, 'should warn not id is present')
      t.equal(loggerMock.warn.args[0][0], WARN_MSG)
      t.end()
    })
  })

  t.test('should not assign enduser.id if no transaction is present', (t) => {
    api.setUserID('my-unit-test-id')
    t.equal(loggerMock.warn.callCount, 1, 'should warn not id is present')
    t.equal(loggerMock.warn.args[0][0], WARN_MSG)
    t.end()
  })
})
