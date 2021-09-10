/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test

const helper = require('../../lib/agent_helper')
const DatastoreShim = require('../../../lib/shim/datastore-shim.js')

let agent = null
let initialize = null
let shim = null
const originalShimRequire = DatastoreShim.prototype.require

test('Lazy loading of native PG client', (t) => {
  t.autoend()

  t.beforeEach(function () {
    agent = helper.loadMockedAgent()
    initialize = require('../../../lib/instrumentation/pg')

    // stub out the require function so semver check does not break in pg instrumentation.
    // Need to return a non-null value for version.
    DatastoreShim.prototype.require = () => {
      return {
        version: 'anything'
      }
    }

    shim = new DatastoreShim(agent, 'postgres')
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)

    // Restore stubbed require
    DatastoreShim.prototype.require = originalShimRequire
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

  t.test('instruments when native getter is called', (t) => {
    const mockPg = getMockModule()

    initialize(agent, mockPg, 'pg', shim)

    let pg = mockPg.native
    t.equal(pg.Client.__NR_original.name, 'NativeClient')

    pg = mockPg
    t.equal(pg.Client.name, 'DefaultClient')

    t.end()
  })

  t.test('does not fail when getter is called multiple times', (t) => {
    const mockPg = getMockModule()

    initialize(agent, mockPg, 'pg', shim)
    const pg1 = mockPg.native

    initialize(agent, mockPg, 'pg', shim)
    const pg2 = mockPg.native

    t.equal(pg1, pg2)

    t.end()
  })

  t.test('does not throw when no native module is found', (t) => {
    const mockPg = getMockModuleNoNative()

    initialize(agent, mockPg, 'pg', shim)
    t.doesNotThrow(function pleaseDoNotThrow() {
      mockPg.native
    })

    t.end()
  })

  t.test('does not interfere with non-native instrumentation', (t) => {
    const mockPg = getMockModule()

    initialize(agent, mockPg, 'pg', shim)
    let nativeClient = mockPg.native
    t.equal(nativeClient.Client.__NR_original.name, 'NativeClient')
    let defaultClient = mockPg
    t.equal(defaultClient.Client.name, 'DefaultClient')

    initialize(agent, mockPg, 'pg', shim)
    nativeClient = mockPg.native
    t.equal(nativeClient.Client.__NR_original.name, 'NativeClient')
    defaultClient = mockPg
    t.equal(defaultClient.Client.name, 'DefaultClient')

    t.end()
  })

  t.test('when pg modules is refreshed in cache', (t) => {
    let mockPg = getMockModule()

    // instrument once
    initialize(agent, mockPg, 'pg', shim)
    const pg1 = mockPg.native
    t.equal(pg1.Client.__NR_original.name, 'NativeClient')

    // simulate deleting from module cache
    mockPg = getMockModule()
    initialize(agent, mockPg, 'pg', shim)
    const pg2 = mockPg.native
    t.equal(pg2.Client.__NR_original.name, 'NativeClient')

    t.not(pg1, pg2)

    t.end()
  })

  t.end()
})
