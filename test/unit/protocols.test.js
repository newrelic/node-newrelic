/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../lib/agent_helper')
const RemoteMethod = require('../../lib/collector/remote-method')

tap.test('errors', (t) => {
  let agent

  t.beforeEach(() => {
    agent = helper.loadMockedAgent()
    agent.config.attributes.enabled = true
    agent.config.run_id = 1

    agent.errors.reconfigure(agent.config)
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
  })

  t.test('should serialize down to match the protocol', (t) => {
    const error = new Error('test')
    error.stack = 'test stack'
    agent.errors.add(null, error)

    const payload = agent.errors.traceAggregator._toPayloadSync()
    RemoteMethod.prototype.serialize(payload, (err, errors) => {
      t.equal(err, null)
      t.same(
        errors,
        '[1,[[0,"Unknown","test","Error",{"userAttributes":{},"agentAttributes":{},' +
          '"intrinsics":{"error.expected":false},"stack_trace":["test stack"]}]]]'
      )
      t.end()
    })
  })

  t.end()
})
