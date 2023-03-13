/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../lib/agent_helper')
const Exception = require('../../../lib/errors').Exception

const API = require('../../../api')

function testErrorGroupingCallback(exception) {
  // Documentation for this is going to suggest matching parts of the exception against regex patterns.
  // This function should return a string.
  // Assuming we've received an exception:
  if (exception.error.message.match(/test/)) {
    return 'test group'
  }
  return 'other error'
}

tap.test('Errors', (t) => {
  t.autoend()
  let agent = null

  t.beforeEach(() => {
    if (agent) {
      helper.unloadAgent(agent)
    }
    agent = helper.loadMockedAgent({
      attributes: {
        enabled: true
      }
    })
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('API should have a setErrorGroupCallback method', (t) => {
    const api = new API(agent)
    t.ok(api.setErrorGroupCallback)
    t.equal(typeof api.setErrorGroupCallback, 'function')
    t.end()
  })

  t.test('calling setErrorGroupCallback should set the errorGroupCallback agent attribute', (t) => {
    const api = new API(agent)
    api.setErrorGroupCallback(testErrorGroupingCallback)
    t.ok(agent.errorGroupCallback)
    t.end()
  })

  t.test(
    'given an error, errorGroupCallback should return a string of 1024 or fewer characters',
    (t) => {
      const api = new API(agent)
      api.setErrorGroupCallback(testErrorGroupingCallback)
      const err = new Error('This is only a test error.')
      const errorGroup = agent.errorGroupCallback(err)
      t.type(errorGroup, 'string', 'errorGroupCallback should return a string')
      t.ok(errorGroup.length < 1024)
      t.equal(errorGroup, 'test group')
    }
  )

  t.test(
    'if errorGroupCallback is set, the Exceptions class should use it automatically to set the `error.group.name` agentAttribute',
    (t) => {
      const api = new API(agent)
      api.setErrorGroupCallback(testErrorGroupingCallback)
      const exception = new Exception(new Error('This is only a test error.'))
      t.ok(exception.agentAttributes['error.group.name'])
      t.equal(exception.agentAttributes['error.group.name'], 'test group')
    }
  )
})
