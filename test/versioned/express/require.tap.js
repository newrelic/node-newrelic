/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')


test("requiring express a bunch of times shouldn't leak listeners", function(t) {
  var agent = helper.instrumentMockedAgent()
  require('express')
  var numListeners = agent.listeners('transactionFinished').length
  require('express')
  t.equal(agent.listeners('transactionFinished').length, numListeners)
  t.end()
})
