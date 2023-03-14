/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../../lib/agent_helper')
const Exception = require('../../../lib/errors').Exception

const API = require('../../../api')

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

  t.test('Agent API should have a setUserID method', (t) => {
    const api = new API(agent)
    t.ok(api.setUserID)
    t.equal(typeof api.setUserID, 'function')
    t.end()
  })

  t.test('calling setUserID should set the enduser.id agent attribute', (t) => {
    const api = new API(agent)
    const id = 'anonymizedUser123456'
    api.setUserID(id)
    t.ok(agent['enduser.id'])
    t.equal(agent['enduser.id'], id)
    t.end()
  })

  t.test(
    'if enduser.id is set, the Exceptions class should use it automatically to set the `enduser.id` agentAttribute',
    (t) => {
      const api = new API(agent)
      const id = 'anonymizedUser567890'
      api.setUserID(id)
      const exception = new Exception(new Error('Test error.'))
      t.ok(exception.agentAttributes['enduser.id'])
      t.equal(exception.agentAttributes['enduser.id'], id)
    }
  )
})
