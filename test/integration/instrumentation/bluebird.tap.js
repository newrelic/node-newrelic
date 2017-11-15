'use strict'

var tap = require('tap')
var helper = require('../../lib/agent_helper')
var testPromiseSegments = require('./promises/segments')
var testTransactionState = require('./promises/transaction-state')
var testMethods = require('./promises/methods')

tap.test('bluebird', function(t) {
  t.autoend()

  t.test('transaction state', function(t) {
    var agent = setupAgent(t)
    var Promise = require('bluebird')
    testTransactionState(t, agent, Promise)
    t.autoend()
  })

  t.test('segments', function(t) {
    var agent = setupAgent(t)
    var Promise = require('bluebird')
    testPromiseSegments(t, agent, Promise)
    t.autoend()
  })

  t.test('methods', function(t) {
    t.autoend()
    testMethods(t, 'bluebird')
  })
})

function setupAgent(t, enableSegments) {
  var agent = helper.instrumentMockedAgent({promise_segments: enableSegments})
  t.tearDown(function tearDown() {
    helper.unloadAgent(agent)
  })
  return agent
}
