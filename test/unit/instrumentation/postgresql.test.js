/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const sinon = require('sinon')
const DatastoreShim = require('../../../lib/shim/datastore-shim.js')
const symbols = require('../../../lib/symbols')

test('Lazy loading of native PG client', async (t) => {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.initialize = require('../../../lib/instrumentation/pg')
    // stub out the require function so semver check does not break in pg instrumentation.
    // Need to return a non-null value for version.
    sinon.stub(DatastoreShim.prototype, 'require').returns({ version: 'anything' })
    ctx.nr.shim = new DatastoreShim(agent, 'postgres')
    ctx.nr.agent = agent
  })

  t.afterEach(function (ctx) {
    helper.unloadAgent(ctx.nr.agent)
    DatastoreShim.prototype.require.restore()
  })

  await t.test('instruments when native getter is called', (t, end) => {
    const { agent, initialize, shim } = t.nr
    const mockPg = getMockModule()

    initialize(agent, mockPg, 'pg', shim)

    let pg = mockPg.native
    assert.equal(pg.Client[symbols.original].name, 'NativeClient')

    pg = mockPg
    assert.equal(pg.Client.name, 'DefaultClient')

    end()
  })

  await t.test('does not fail when getter is called multiple times', (t, end) => {
    const { agent, initialize, shim } = t.nr
    const mockPg = getMockModule()

    initialize(agent, mockPg, 'pg', shim)
    const pg1 = mockPg.native

    initialize(agent, mockPg, 'pg', shim)
    const pg2 = mockPg.native

    assert.equal(pg1, pg2)

    end()
  })

  await t.test('does not throw when no native module is found', (t, end) => {
    const { agent, initialize, shim } = t.nr
    const mockPg = getMockModuleNoNative()

    initialize(agent, mockPg, 'pg', shim)
    assert.doesNotThrow(function pleaseDoNotThrow() {
      mockPg.native
    })

    end()
  })

  await t.test('does not interfere with non-native instrumentation', (t, end) => {
    const { agent, initialize, shim } = t.nr
    const mockPg = getMockModule()

    initialize(agent, mockPg, 'pg', shim)
    let nativeClient = mockPg.native
    assert.equal(nativeClient.Client[symbols.original].name, 'NativeClient')
    let defaultClient = mockPg
    assert.equal(defaultClient.Client.name, 'DefaultClient')

    initialize(agent, mockPg, 'pg', shim)
    nativeClient = mockPg.native
    assert.equal(nativeClient.Client[symbols.original].name, 'NativeClient')
    defaultClient = mockPg
    assert.equal(defaultClient.Client.name, 'DefaultClient')

    end()
  })

  await t.test('when pg modules is refreshed in cache', (t, end) => {
    const { agent, initialize, shim } = t.nr
    let mockPg = getMockModule()

    // instrument once
    initialize(agent, mockPg, 'pg', shim)
    const pg1 = mockPg.native
    assert.equal(pg1.Client[symbols.original].name, 'NativeClient')

    // simulate deleting from module cache
    mockPg = getMockModule()
    initialize(agent, mockPg, 'pg', shim)
    const pg2 = mockPg.native
    assert.equal(pg2.Client[symbols.original].name, 'NativeClient')

    assert.notEqual(pg1, pg2)

    end()
  })
})

function getMockModuleNoNative() {
  function PG(clientConstructor) {
    this.Client = clientConstructor
  }

  function DefaultClient() {}
  DefaultClient.prototype.query = function () {}
  function NativeClient() {}
  NativeClient.prototype.query = function () {}

  const mockPg = new PG(DefaultClient)
  mockPg.__defineGetter__('native', function () {
    return null
  })
  return mockPg
}

function getMockModule() {
  function PG(clientConstructor) {
    this.Client = clientConstructor
  }

  function DefaultClient() {}
  DefaultClient.prototype.query = function () {}
  function NativeClient() {}
  NativeClient.prototype.query = function () {}

  const mockPg = new PG(DefaultClient)
  mockPg.__defineGetter__('native', function () {
    delete mockPg.native
    mockPg.native = new PG(NativeClient)
    return mockPg.native
  })
  return mockPg
}
