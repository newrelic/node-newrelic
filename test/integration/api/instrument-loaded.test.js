/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const { tspl } = require('@matteo.collina/tspl')
const express = require('express')
const API = require('../../../api')
const agentHelper = require('../../lib/agent_helper')

test('ensures instrumentation with shim.require can run without an error', (t) => {
  const agent = agentHelper.instrumentMockedAgent()
  t.after(() => {
    agentHelper.unloadAgent(agent)
  })

  const api = new API(agent)

  api.instrumentLoadedModule('express', express)
  assert.ok(typeof express === 'function')
})

// Rest of these tests are in parent because this does not bootstrap instrumentation
// but instead loads agent and every test manually instruments a package
test('manual instrumenting', async (t) => {
  t.beforeEach((ctx) => {
    const agent = agentHelper.loadMockedAgent()
    const api = new API(agent)
    ctx.nr = {
      agent,
      api
    }
  })

  t.afterEach((ctx) => {
    agentHelper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should return false when a function errors during instrumentation', async (t) => {
    const { api } = t.nr
    const plan = tspl(t, { plan: 2 })

    const moduleName = 'express'
    api.instrument(moduleName, onRequire)

    function onRequire() {
      plan.ok(1, 'should hit the onRequire')
      throw new Error('Oh No!')
    }

    const result = api.instrumentLoadedModule(moduleName, {})

    plan.equal(result, false)
    await plan.completed
  })

  await t.test(
    'should return false when instrumentation handler returns false (did not instrument)',
    async (t) => {
      const { api } = t.nr
      const plan = tspl(t, { plan: 2 })

      const moduleName = 'express'
      api.instrument(moduleName, onRequire)

      function onRequire() {
        plan.ok(1, 'should hit the onRequire')
        return false
      }

      const result = api.instrumentLoadedModule(moduleName, {})

      plan.equal(result, false)
      await plan.completed
    }
  )

  await t.test(
    'should return true when instrumentation handler does not return anything',
    async (t) => {
      const { api } = t.nr
      const plan = tspl(t, { plan: 2 })

      const moduleName = 'express'
      api.instrument(moduleName, onRequire)

      function onRequire() {
        plan.ok(1, 'should hit the onRequire')
      }

      const result = api.instrumentLoadedModule(moduleName, {})

      plan.equal(result, true)
      await plan.completed
    }
  )
})
