'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')


test('preserves transaction in resolve callback', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  var total = 2
  var finished = 0

  for (var i = 0; i < total; i++) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.resolve().then(function anonymous() {
        checkTransaction(t, agent, transaction)
        finished++
        if (finished === total) t.end()
      })
    })
  }
})

test('preserves transaction in reject callback', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  var total = 2
  var finished = 0

  for (var i = 0; i < total; i++) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.reject(new Error('some error')).then(
        function() { /* success */ },
        function anonymous() {
          checkTransaction(t, agent, transaction)
          finished++
          if (finished === total) t.end()
        }
      )
    })
  }
})

test('preserves transaction in catch callback', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  var total = 2
  var finished = 0

  for (var i = 0; i < total; i++) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.reject(new Error('some error'))
        .catch(function(error) {
          checkTransaction(t, agent, transaction)
          finished++
          if (finished === total) t.end()
        })
    })
  }
})

test('preserves transaction with chained promises', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Promise.resolve(1).then(function() {
      return 1
    })
    .then(function() {
      return 2
    })
    .then(function() {
      checkTransaction(t, agent, transaction)
      t.end()
    })
  })
})

test('preserves transaction with chained promises and catch callback', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Promise.resolve(1).then(function() {
      return 1
    })
    .then(function() {
      throw new Error('some error')
    })
    .catch(function() {
      checkTransaction(t, agent, transaction)
      t.end()
    })
  })
})

function setupAgent(t) {
  var agent = helper.instrumentMockedAgent()
  t.tearDown(function tearDown() {
    helper.unloadAgent(agent)
  })
  return agent
}

function checkTransaction(t, agent, transaction) {
  t.ok(agent.getTransaction() != null, 'there should be a transaction')
  t.equal(agent.getTransaction().id, transaction.id)
}

