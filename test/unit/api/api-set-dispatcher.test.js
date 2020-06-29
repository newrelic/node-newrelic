/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

tap.test('Agent API - dispatch setter', (t) => {
  t.autoend()

  let agent = null
  let api = null

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent()
    api = new API(agent)

    done()
  })

  t.afterEach((done) => {
    agent.environment.clearDispatcher()

    helper.unloadAgent(agent)
    agent = null

    done()
  })

  t.test("exports a dispatcher setter", (t) => {
    t.ok(api.setDispatcher)
    t.type(api.setDispatcher, 'function')

    t.end()
  })

  t.test("sets the dispatcher", (t) => {
    api.setDispatcher('test')

    const dispatcher = agent.environment.get('Dispatcher')
    t.ok(dispatcher.includes('test'))

    t.end()
  })

  t.test("sets the dispatcher and version", (t) => {
    api.setDispatcher('test', 2)

    t.ok(dispatcherIncludes(agent, 'test'))
    t.ok(dispatcherVersionIncludes(agent, '2'))

    t.end()
  })

  t.test("does not allow internal calls to setDispatcher to override", (t) => {
    agent.environment.setDispatcher('internal', '3')
    t.ok(dispatcherIncludes(agent, 'internal'))
    t.ok(dispatcherVersionIncludes(agent, '3'))

    api.setDispatcher('test', 2)
    t.ok(dispatcherIncludes(agent, 'test'))
    t.ok(dispatcherVersionIncludes(agent, '2'))

    agent.environment.setDispatcher('internal', '3')
    t.ok(dispatcherIncludes(agent, 'test'))
    t.ok(dispatcherVersionIncludes(agent, '2'))

    t.end()
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
