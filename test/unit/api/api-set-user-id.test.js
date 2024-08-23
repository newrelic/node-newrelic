/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
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

test('Agent API = set user id', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    loggerMock.warn.reset()
    const agent = helper.loadMockedAgent({
      attributes: {
        enabled: true
      }
    })
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should have a setUserID method', (t, end) => {
    const { api } = t.nr
    assert.ok(api.setUserID)
    assert.equal(typeof api.setUserID, 'function', 'api.setUserID should be a function')
    end()
  })

  await t.test('should set the enduser.id on transaction attributes', (t, end) => {
    const { agent, api } = t.nr
    const id = 'anonymizedUser123456'
    helper.runInTransaction(agent, (tx) => {
      api.setUserID(id)
      assert.equal(loggerMock.warn.callCount, 0, 'should not log warnings when setUserID succeeds')
      const attrs = tx.trace.attributes.get(DESTINATIONS.TRANS_EVENT)
      assert.equal(attrs['enduser.id'], id, 'should set enduser.id attribute on transaction')
      const traceAttrs = tx.trace.attributes.get(DESTINATIONS.TRANS_TRACE)
      assert.equal(traceAttrs['enduser.id'], id, 'should set enduser.id attribute on transaction')
      end()
    })
  })

  await t.test('should set enduser.id attribute on error event when in a transaction', (t, end) => {
    const { agent, api } = t.nr
    const id = 'anonymizedUser567890'
    helper.runInTransaction(agent, (tx) => {
      api.setUserID(id)
      const exception = new Exception(new Error('Test error.'))
      const [...data] = createError(tx, exception, agent.config)
      const params = data.at(-2)
      assert.equal(
        params.agentAttributes['enduser.id'],
        id,
        'should set enduser.id attribute on error'
      )
      end()
    })
  })

  const WARN_MSG =
    'User id is empty or not in a transaction, not assigning `enduser.id` attribute to transaction events, trace events, and/or errors.'

  const emptyOptions = [null, undefined, '']
  await Promise.all(
    emptyOptions.map(async (value) => {
      await t.test(`should not assign enduser.id if id is '${value}'`, (t, end) => {
        const { api } = t.nr
        api.setUserID(value)
        assert.equal(loggerMock.warn.callCount, 1, 'should warn not id is present')
        assert.equal(loggerMock.warn.args[0][0], WARN_MSG)
        end()
      })
    })
  )

  await t.test('should not assign enduser.id if no transaction is present', (t, end) => {
    const { api } = t.nr
    api.setUserID('my-unit-test-id')
    assert.equal(loggerMock.warn.callCount, 1, 'should warn not id is present')
    assert.equal(loggerMock.warn.args[0][0], WARN_MSG)
    end()
  })
})
