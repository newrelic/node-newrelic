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
const moduleName = './test/lib/example-deps/lib/node_modules/pkg-1/foo.js'

test('Agent API - instrumentLoadedModule', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = agentHelper.instrumentMockedAgent()

    const api = new API(agent)

    const appMock = {
      application: {
        use: function use() {}
      },
    }

    ctx.nr.api = api
    ctx.nr.agent = agent
    ctx.nr.appMock = appMock

    const opts = {
      moduleName,
      absolutePath: moduleName,
      onRequire(shim, module) {
        shim.wrap(module.application, 'use', function wrapUse(shim, use) {
          return function wrappedUse() {
            return use.apply(this, arguments)
          }
        })
      }
    }
    api.instrument(opts)
  })

  t.afterEach((ctx) => {
    agentHelper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should be callable without an error', (t) => {
    const { api, appMock } = t.nr
    api.instrumentLoadedModule(moduleName, appMock)
  })

  await t.test('should return true when a function is instrumented', (t) => {
    const { api, appMock } = t.nr
    const didInstrument = api.instrumentLoadedModule(moduleName, appMock)
    assert.equal(didInstrument, true)
  })

  await t.test('should wrap express.application.use', (t) => {
    const { api, appMock } = t.nr
    api.instrumentLoadedModule(moduleName, appMock)

    assert.equal(typeof appMock, 'object')

    const shim = appMock[symbols.shim]
    const isWrapped = shim.isWrapped(appMock.application.use)
    assert.ok(isWrapped)
  })

  await t.test('should return false when it cannot resolve module', (t) => {
    const { api } = t.nr
    const result = api.instrumentLoadedModule('myTestModule')

    assert.equal(result, false)
  })

  await t.test('should return false when no instrumentation exists', (t) => {
    const { api } = t.nr
    const result = api.instrumentLoadedModule('sinon', {})

    assert.equal(result, false)
  })

  await t.test('should not instrument/wrap multiple times on multiple invocations', (t) => {
    const { api, appMock } = t.nr
    const originalUse = appMock.application.use

    api.instrumentLoadedModule(moduleName, appMock)
    api.instrumentLoadedModule(moduleName, appMock)

    const nrOriginal = appMock.application.use[symbols.original]
    assert.equal(nrOriginal, originalUse)
  })

  await t.test('should not throw if supported module is not installed', function (t) {
    const { api } = t.nr
    // We need a supported module in our test. We need that module _not_ to be
    // installed. We'll use mysql.  This first bit ensures
    const EMPTY_MODULE = {}
    let mod = EMPTY_MODULE
    try {
      mod = require('mysql')
    } catch {}
    assert.ok(mod === EMPTY_MODULE, 'mysql is not installed')

    // attempt to instrument -- if nothing throws we're good
    assert.doesNotThrow(() => {
      api.instrumentLoadedModule('mysql', mod)
    })
  })
})
