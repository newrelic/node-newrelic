/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { match } = require('../lib/custom-assertions')
const helper = require('../lib/agent_helper')

const RemoteMethod = require('../../lib/collector/remote-method')

test('errors', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    agent.config.attributes.enabled = true
    agent.config.run_id = 1

    agent.errors.traceAggregator.reconfigure(agent.config)

    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should serialize down to match the protocol', (t, end) => {
    const { agent } = t.nr
    const error = new Error('test')
    error.stack = 'test stack'
    agent.errors.add(null, error)

    const payload = agent.errors.traceAggregator._toPayloadSync()
    RemoteMethod.prototype.serialize(payload, (err, errors) => {
      assert.equal(err, null)
      assert.equal(
        match(
          errors,
          '[1,[[0,"Unknown","test","Error",{"userAttributes":{},"agentAttributes":{},' +
            '"intrinsics":{"error.expected":false},"stack_trace":["test stack"]},null]]]'
        ),
        true
      )
      end()
    })
  })
})
