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

test('Agent API = ignore apdex', async (t) => {
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

  await t.test('should set ignoreApdex on active transaction', (t, end) => {
    const { agent, api } = t.nr
    helper.runInTransaction(agent, (tx) => {
      api.ignoreApdex()
      assert.equal(tx.ignoreApdex, true)
      assert.equal(loggerMock.warn.callCount, 0)
      end()
    })
  })

  await t.test('should log warning if not in active transaction', (t, end) => {
    const { api } = t.nr
    api.ignoreApdex()
    assert.equal(loggerMock.warn.callCount, 1)
    assert.equal(
      loggerMock.warn.args[0][0],
      'Apdex will not be ignored. ignoreApdex must be called within the scope of a transaction.'
    )
    end()
  })
})
