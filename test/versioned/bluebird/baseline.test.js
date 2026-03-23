/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const { version } = require('bluebird/package.json')
const { assertPackageMetrics } = require('../../lib/custom-assertions')

const {
  testAsCallbackBehavior,
  testCatchBehavior,
  testFinallyBehavior,
  testFromCallbackBehavior,
  testRejectBehavior,
  testResolveBehavior,
  testThrowBehavior,
  testTryBehavior,
} = require('./common-tests')

testTryBehavior('try')
testTryBehavior('attempt')
testResolveBehavior('cast')
testResolveBehavior('fulfilled')
testResolveBehavior('resolve')
testThrowBehavior('thenThrow')
testThrowBehavior('throw')
testFromCallbackBehavior('fromCallback')
testFromCallbackBehavior('fromNode')
testFinallyBehavior('finally')
testFinallyBehavior('lastly')
testRejectBehavior('reject')
testRejectBehavior('rejected')
testAsCallbackBehavior('asCallback')
testAsCallbackBehavior('nodeify')
testCatchBehavior('catch')
testCatchBehavior('caught')

test('tracking metrics', async function (t) {
  const agent = helper.loadTestAgent(t)
  t.after(() => {
    helper.unloadAgent(agent)
  })
  const Promise = require('bluebird')
  await helper.runInTransaction(agent, async (tx) => {
    assert.ok(tx)
    await Promise.resolve()
    const ctx = agent.tracer.getContext()
    assert.ok(ctx.transaction)
  })

  assertPackageMetrics({ agent, pkg: 'bluebird', version, subscriberType: true })
})
