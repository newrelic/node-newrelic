/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const ConglomerateShim = require('../../../lib/shim/conglomerate-shim')
const DatastoreShim = require('../../../lib/shim/datastore-shim')
const helper = require('../../lib/agent_helper')
const MessageShim = require('../../../lib/shim/message-shim')
const PromiseShim = require('../../../lib/shim/promise-shim')
const Shim = require('../../../lib/shim/shim')
const TransactionShim = require('../../../lib/shim/transaction-shim')
const WebFrameworkShim = require('../../../lib/shim/webframework-shim')

test('ConglomerateShim', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.shim = new ConglomerateShim(agent, 'test-module')
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should require an agent parameter', () => {
    assert.throws(
      () => new ConglomerateShim(),
      'Error: Shim must be initialized with an agent and module name.'
    )
  })
  await t.test('should require a module name parameter', (t) => {
    const { agent } = t.nr
    assert.throws(
      () => new ConglomerateShim(agent),
      'Error: Shim must be initialized with an agent and module name.'
    )
  })

  await t.test('should exist for each shim type', (t) => {
    const { shim } = t.nr
    assert.equal(shim.GENERIC, 'generic')
    assert.equal(shim.DATASTORE, 'datastore')
    assert.equal(shim.MESSAGE, 'message')
    assert.equal(shim.PROMISE, 'promise')
    assert.equal(shim.TRANSACTION, 'transaction')
    assert.equal(shim.WEB_FRAMEWORK, 'web-framework')
  })

  await t.test('should construct a new shim', (t) => {
    const { shim } = t.nr
    const specialShim = shim.makeSpecializedShim(shim.GENERIC, 'foobar')
    assert.ok(specialShim instanceof Shim)
    assert.notEqual(specialShim, shim)
  })

  await t.test('should be an instance of the correct class', (t) => {
    const { shim } = t.nr
    assert.ok(shim.makeSpecializedShim(shim.GENERIC, 'foobar') instanceof Shim)
    assert.ok(shim.makeSpecializedShim(shim.DATASTORE, 'foobar') instanceof DatastoreShim)
    assert.ok(shim.makeSpecializedShim(shim.MESSAGE, 'foobar') instanceof MessageShim)
    assert.ok(shim.makeSpecializedShim(shim.PROMISE, 'foobar') instanceof PromiseShim)
    assert.ok(shim.makeSpecializedShim(shim.TRANSACTION, 'foobar') instanceof TransactionShim)
    assert.ok(shim.makeSpecializedShim(shim.WEB_FRAMEWORK, 'foobar') instanceof WebFrameworkShim)
  })

  await t.test('should assign properties from parent', (t) => {
    const { agent } = t.nr
    const mod = 'test-mod'
    const name = mod
    const version = '1.0.0'
    const shim = new ConglomerateShim(agent, mod, mod, name, version)
    assert.equal(shim.moduleName, mod)
    assert.equal(agent, shim._agent)
    assert.equal(shim.pkgVersion, version)
    function childFn() {}
    const childShim = shim.makeSpecializedShim(shim.DATASTORE, childFn)
    assert.deepEqual(shim._agent, childShim._agent)
    assert.equal(shim.moduleName, childShim.moduleName)
    assert.equal(shim.pkgVersion, childShim.pkgVersion)
    assert.equal(shim.id, childShim.id)
  })
})
