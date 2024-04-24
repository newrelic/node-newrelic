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

tap.test('Agent API = ignore apdex', (t) => {
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

  t.test('should set ignoreApdex on active transaction', (t) => {
    helper.runInTransaction(agent, (tx) => {
      api.ignoreApdex()
      t.equal(tx.ignoreApdex, true)
      t.equal(loggerMock.warn.callCount, 0)
      t.end()
    })
  })

  t.test('should log warning if not in active transaction', (t) => {
    api.ignoreApdex()
    t.equal(loggerMock.warn.callCount, 1)
    t.equal(
      loggerMock.warn.args[0][0],
      'Apdex will not be ignored. ignoreApdex must be called within the scope of a transaction.'
    )
    t.end()
  })

  t.end()
})
