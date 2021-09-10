/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const helper = require('../../lib/agent_helper')

test('transaction state', function (t) {
  t.plan(1)

  t.test('should be preserved over timers regardless of order required', function (t) {
    require('continuation-local-storage')
    const agent = setupAgent(t)
    helper.runInTransaction(agent, function inTransaction(txn) {
      setTimeout(function () {
        t.equal(agent.getTransaction(), txn, 'should maintain tx state')
        t.end()
      }, 0)
    })
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
