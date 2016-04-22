'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')
var assertSegments = require('../../lib/metrics_helper').assertSegments
var testPromiseSegments = require('../../integration/instrumentation/promises/segments.js')
var testTransactionState = require('../../integration/instrumentation/promises/transaction-state.js')


test('transaction state', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')
  testTransactionState(t, agent, Promise)
})

test('segments', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')
  testPromiseSegments(t, agent, Promise)
})

test('no transaction', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  Promise.resolve(0).then(function step1() {
    return 1
  })
  .then(function step2() {
    return 2
  })
  .then(function finalHandler(res) {
    t.equal(res, 2, 'should be the correct result')
  })
  .finally(function finallyHandler() {
    t.end()
  })
})

test('asCallback', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var p = new Promise(function(resolve, reject) {
      resolve(123)
    }).asCallback(function() {
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})


function setupAgent(t, enableSegments) {
  var agent = helper.instrumentMockedAgent({promise_segments: enableSegments})
  t.tearDown(function tearDown() {
    helper.unloadAgent(agent)
  })
  return agent
}