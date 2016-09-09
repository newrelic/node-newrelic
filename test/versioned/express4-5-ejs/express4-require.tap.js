'use strict'

var test = require('tap').test
var skip = require('./skip')
var helper = require('../../lib/agent_helper')

/*
 *
 * CONSTANTS
 *
 */
var TEST_OPTIONS = {
  skip: skip()
}

test(
  "requiring express a bunch of times shouldn't leak listeners",
  TEST_OPTIONS,
  function (t) {
    var agent = helper.instrumentMockedAgent()
    require('express')
    var numListeners = agent.listeners('transactionFinished').length
    require('express')
    t.equal(agent.listeners('transactionFinished').length, numListeners)
    t.end()
  }
)
