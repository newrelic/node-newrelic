/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const agentHelper = require('../../lib/agent_helper')
const symbols = require('../../../lib/symbols')

test('Agent API - instrumentLoadedModule', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = agentHelper.instrumentMockedAgent()

    ctx.nr.api = new API(agent)

    const expressMock = {
      application: {
        use: function use() {}
      },
      Router: {}
    }
    ctx.nr.agent = agent
    ctx.nr.expressMock = expressMock
  })

  t.afterEach((ctx) => {
    agentHelper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should be callable without an error', (t, end) => {
    const { api, expressMock } = t.nr
    api.instrumentLoadedModule('express', expressMock)

    end()
  })

  await t.test('should return true when a function is instrumented', (t, end) => {
    const { api, expressMock } = t.nr
    const didInstrument = api.instrumentLoadedModule('express', expressMock)
    assert.equal(didInstrument, true)

    end()
  })

  await t.test('should wrap express.application.use', (t, end) => {
    const { api, expressMock } = t.nr
    api.instrumentLoadedModule('express', expressMock)

    assert.equal(typeof expressMock, 'object')

    const shim = expressMock[symbols.shim]
    const isWrapped = shim.isWrapped(expressMock.application.use)
    assert.ok(isWrapped)

    end()
  })

  await t.test('should return false when it cannot resolve module', (t, end) => {
    const { api } = t.nr
    const result = api.instrumentLoadedModule('myTestModule')

    assert.equal(result, false)

    end()
  })

  await t.test('should return false when no instrumentation exists', (t, end) => {
    const { api } = t.nr
    const result = api.instrumentLoadedModule('sinon', {})

    assert.equal(result, false)

    end()
  })

  await t.test('should not instrument/wrap multiple times on multiple invocations', (t, end) => {
    const { api, expressMock } = t.nr
    const originalUse = expressMock.application.use

    api.instrumentLoadedModule('express', expressMock)
    api.instrumentLoadedModule('express', expressMock)

    const nrOriginal = expressMock.application.use[symbols.original]
    assert.equal(nrOriginal, originalUse)

    end()
  })

  await t.test('should not throw if supported module is not installed', function (t, end) {
    const { api } = t.nr
    // We need a supported module in our test. We need that module _not_ to be
    // installed. We'll use mysql.  This first bit ensures
    const EMPTY_MODULE = {}
    let mod = EMPTY_MODULE
    try {
      // eslint-disable-next-line node/no-missing-require
      mod = require('mysql')
    } catch (e) {}
    assert.ok(mod === EMPTY_MODULE, 'mysql is not installed')

    // attempt to instrument -- if nothing throws we're good
    assert.doesNotThrow(() => {
      api.instrumentLoadedModule('mysql', mod)
    })

    end()
  })
})
