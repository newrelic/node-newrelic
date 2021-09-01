/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')
const ConglomerateShim = require('../../../lib/shim/conglomerate-shim')
const DatastoreShim = require('../../../lib/shim/datastore-shim')
const helper = require('../../lib/agent_helper')
const MessageShim = require('../../../lib/shim/message-shim')
const PromiseShim = require('../../../lib/shim/promise-shim')
const Shim = require('../../../lib/shim/shim')
const TransactionShim = require('../../../lib/shim/transaction-shim')
const WebFrameworkShim = require('../../../lib/shim/webframework-shim')

test('ConglomerateShim', (t) => {
  t.autoend()
  let agent = null
  let shim = null

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    shim = new ConglomerateShim(agent, 'test-module')
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    agent = null
    shim = null
  })

  t.test('should require an agent parameter', (t) => {
    t.throws(() => new ConglomerateShim(), /^Shim must be initialized with .*? agent/)
    t.end()
  })
  t.test('should require a module name parameter', (t) => {
    t.throws(() => new ConglomerateShim(agent), /^Shim must be initialized with .*? module name/)
    t.end()
  })

  t.test('should exist for each shim type', (t) => {
    t.ok(shim.GENERIC, 'generic')
    t.ok(shim.DATASTORE, 'datastore')
    t.ok(shim.MESSAGE, 'message')
    t.ok(shim.PROMISE, 'promise')
    t.ok(shim.TRANSACTION, 'transaction')
    t.ok(shim.WEB_FRAMEWORK, 'web-framework')
    t.end()
  })

  t.test('should construct a new shim', (t) => {
    const specialShim = shim.makeSpecializedShim(shim.GENERIC, 'foobar')
    t.ok(specialShim instanceof Shim)
    t.not(specialShim, shim)
    t.end()
  })

  t.test('should be an instance of the correct class', (t) => {
    t.ok(shim.makeSpecializedShim(shim.GENERIC, 'foobar') instanceof Shim)
    t.ok(shim.makeSpecializedShim(shim.DATASTORE, 'foobar') instanceof DatastoreShim)
    t.ok(shim.makeSpecializedShim(shim.MESSAGE, 'foobar') instanceof MessageShim)
    t.ok(shim.makeSpecializedShim(shim.PROMISE, 'foobar') instanceof PromiseShim)
    t.ok(shim.makeSpecializedShim(shim.TRANSACTION, 'foobar') instanceof TransactionShim)
    t.ok(shim.makeSpecializedShim(shim.WEB_FRAMEWORK, 'foobar') instanceof WebFrameworkShim)
    t.end()
  })
})
