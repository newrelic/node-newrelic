/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const agentHelper = require('../../lib/agent_helper')
const symbols = require('../../../lib/symbols')

tap.test('Agent API - instrumentLoadedModule', (t) => {
  t.autoend()

  let agent
  let api
  let expressMock

  t.beforeEach(() => {
    agent = agentHelper.instrumentMockedAgent()

    api = new API(agent)

    expressMock = {}
    expressMock.application = {}
    expressMock.application.use = function use() {}
    expressMock.Router = {}
  })

  t.afterEach(() => {
    agentHelper.unloadAgent(agent)
    agent = null
    api = null
    expressMock = null
  })

  t.test('should be callable without an error', (t) => {
    api.instrumentLoadedModule('express', expressMock)

    t.end()
  })

  t.test('should return true when a function is instrumented', (t) => {
    const didInstrument = api.instrumentLoadedModule('express', expressMock)
    t.equal(didInstrument, true)

    t.end()
  })

  t.test('should wrap express.application.use', (t) => {
    api.instrumentLoadedModule('express', expressMock)

    t.type(expressMock, 'object')

    const shim = expressMock[symbols.shim]
    const isWrapped = shim.isWrapped(expressMock.application.use)
    t.ok(isWrapped)

    t.end()
  })

  t.test('should return false when it cannot resolve module', (t) => {
    const result = api.instrumentLoadedModule('myTestModule')

    t.equal(result, false)

    t.end()
  })

  t.test('should return false when no instrumentation exists', (t) => {
    const result = api.instrumentLoadedModule('tap', {})

    t.equal(result, false)

    t.end()
  })

  t.test('should not instrument/wrap multiple times on multiple invocations', (t) => {
    const originalUse = expressMock.application.use

    api.instrumentLoadedModule('express', expressMock)
    api.instrumentLoadedModule('express', expressMock)

    const nrOriginal = expressMock.application.use[symbols.original]
    t.equal(nrOriginal, originalUse)

    t.end()
  })

  t.test('should not throw if supported module is not installed', function (t) {
    // We need a supported module in our test. We need that module _not_ to be
    // installed. We'll use mysql.  This first bit ensures
    const EMPTY_MODULE = {}
    let mod = EMPTY_MODULE
    try {
      // eslint-disable-next-line node/no-missing-require
      mod = require('mysql')
    } catch (e) {}
    t.ok(mod === EMPTY_MODULE, 'mysql is not installed')

    // attempt to instrument -- if nothing throws we're good
    try {
      api.instrumentLoadedModule('mysql', mod)
    } catch (e) {
      t.error(e)
    }
    t.end()
  })
})
