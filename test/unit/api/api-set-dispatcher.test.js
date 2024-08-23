/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

test('Agent API - dispatch setter', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    const { agent } = ctx.nr
    agent.environment.clearDispatcher()
    helper.unloadAgent(agent)
  })

  await t.test('exports a dispatcher setter', (t, end) => {
    const { api } = t.nr
    assert.ok(api.setDispatcher)
    assert.equal(typeof api.setDispatcher, 'function')

    end()
  })

  await t.test('sets the dispatcher', (t, end) => {
    const { agent, api } = t.nr
    api.setDispatcher('test')

    const dispatcher = agent.environment.get('Dispatcher')
    assert.ok(dispatcher.includes('test'))

    end()
  })

  await t.test('sets the dispatcher and version', (t, end) => {
    const { agent, api } = t.nr
    api.setDispatcher('test', 2)

    assert.ok(dispatcherIncludes(agent, 'test'))
    assert.ok(dispatcherVersionIncludes(agent, '2'))

    end()
  })

  await t.test('does not allow internal calls to setDispatcher to override', (t, end) => {
    const { agent, api } = t.nr
    agent.environment.setDispatcher('internal', '3')
    assert.ok(dispatcherIncludes(agent, 'internal'))
    assert.ok(dispatcherVersionIncludes(agent, '3'))

    api.setDispatcher('test', 2)
    assert.ok(dispatcherIncludes(agent, 'test'))
    assert.ok(dispatcherVersionIncludes(agent, '2'))

    agent.environment.setDispatcher('internal', '3')
    assert.ok(dispatcherIncludes(agent, 'test'))
    assert.ok(dispatcherVersionIncludes(agent, '2'))

    end()
  })
})

function dispatcherIncludes(agent, expected) {
  const dispatcher = agent.environment.get('Dispatcher')
  return dispatcher.includes(expected)
}

function dispatcherVersionIncludes(agent, expected) {
  const dispatcherVersion = agent.environment.get('Dispatcher Version')
  return dispatcherVersion.includes(expected)
}
