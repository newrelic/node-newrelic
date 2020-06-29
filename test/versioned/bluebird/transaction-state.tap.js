/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var testsDir = '../../integration/instrumentation/promises'

var helper = require('../../lib/agent_helper')
var tap = require('tap')
var testTransactionState = require(testsDir + '/transaction-state')


tap.test('bluebird', function(t) {
  t.autoend()

  t.test('transaction state', function(t) {
    var agent = setupAgent(t)
    var Promise = require('bluebird')
    testTransactionState(t, agent, Promise)
    t.autoend()
  })
})

function setupAgent(t, enableSegments) {
  var agent = helper.instrumentMockedAgent({
    feature_flag: {promise_segments: enableSegments}
  })
  t.tearDown(function tearDown() {
    helper.unloadAgent(agent)
  })
  return agent
}
