/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { test } = require('tap')
const mongodb = require('mongodb')
const API = require('../../../api')
const agentHelper = require('../../lib/agent_helper')

test('ensures instrumentation with shim.require can run without an error', (t) => {
  const agent = agentHelper.instrumentMockedAgent()
  t.teardown(() => {
    agentHelper.unloadAgent(agent)
  })

  const api = new API(agent)

  api.instrumentLoadedModule('mongodb', mongodb)
  t.type(mongodb, 'function')
  t.end()
})

test('should return false when a function errors during instrumentation', (t) => {
  t.plan(2)

  const agent = agentHelper.loadMockedAgent()
  t.teardown(() => {
    agentHelper.unloadAgent(agent)
  })

  const api = new API(agent)

  const moduleName = 'express'
  api.instrument(moduleName, onRequire)

  function onRequire() {
    t.ok('should hit the onRequire')
    throw new Error('Oh No!')
  }

  const result = api.instrumentLoadedModule(moduleName, {})

  t.equal(result, false)
})

test('should return false when instrumentation handler returns false (did not instrument)', (t) => {
  t.plan(2)

  const agent = agentHelper.loadMockedAgent()
  t.teardown(() => {
    agentHelper.unloadAgent(agent)
  })

  const api = new API(agent)

  const moduleName = 'express'
  api.instrument(moduleName, onRequire)

  function onRequire() {
    t.ok('should hit the onRequire')
    return false
  }

  const result = api.instrumentLoadedModule(moduleName, {})

  t.equal(result, false)
})

test('should return true when instrumentation handler does not return anything', (t) => {
  t.plan(2)

  const agent = agentHelper.loadMockedAgent()
  t.teardown(() => {
    agentHelper.unloadAgent(agent)
  })

  const api = new API(agent)

  const moduleName = 'express'
  api.instrument(moduleName, onRequire)

  function onRequire() {
    t.ok('should hit the onRequire')
  }

  const result = api.instrumentLoadedModule(moduleName, {})

  t.equal(result, true)
})
