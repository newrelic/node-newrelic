/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('../../lib/agent_helper')
const tap = require('tap')
const testTransactionState = require('../../lib/promises/transaction-state')

tap.test('bluebird', function (t) {
  t.autoend()

  t.test('transaction state', function (t) {
    const agent = setupAgent(t)
    const Promise = require('bluebird')
    testTransactionState(t, agent, Promise)
    t.autoend()
  })
})

function setupAgent(t, enableSegments) {
  const agent = helper.instrumentMockedAgent({
    feature_flag: { promise_segments: enableSegments }
  })
  t.teardown(function tearDown() {
    helper.unloadAgent(agent)
  })
  return agent
}
