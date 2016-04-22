'use strict'

var test = require('tap').test
var helper = require('../../../lib/agent_helper')

var COUNT = 2

module.exports = runTests
runTests.runMultiple = runMultiple


function runTests(t, agent, Promise) {

  performTests('Fullfillment Factories',
    function(Promise, val) { return Promise.resolve(val) },
    function(Promise, err) { return Promise.reject(err) }
  )

  performTests('New Synchronous',
    function(Promise, val) { return new Promise(function(res, rej) { res(val) }) },
    function(Promise, err) { return new Promise(function(res, rej) { rej(err) }) }
  )

  performTests('New Asynchronous',
    function(Promise, val) {
      return new Promise(function(res, rej) {
        setTimeout(function() { res(val) }, 10)
      })
    },
    function(Promise, err) {
      return new Promise(function(res, rej) {
        setTimeout(function() { rej(err) }, 10)
      })
    }
  )

  performTests('Promise.method',
    function(Promise, val) { return Promise.method(function() { return val })() },
    function(Promise, err) { return Promise.method(function() { throw err })() }
  )

  performTests('Promise.try',
    function(Promise, val) { return Promise.try(function() { return val }) },
    function(Promise, err) { return Promise.try(function() { throw err }) }
  )

  function performTests(name, resolve, reject) {
    doPerformTests(name, resolve, reject, true)
    doPerformTests(name, resolve, reject, false)
  }

  function doPerformTests(name, resolve, reject, enableSegments) {
    t.test(name + ': preserves transaction in resolve callback', function(t) {
      t.plan(4 * COUNT)

      runMultiple(COUNT, function(i, cb) {
        helper.runInTransaction(agent, function transactionWrapper(transaction) {
          resolve(Promise)
            .then(function step() {
              t.ok(true, 'should not change execution profile')
              return i
            })
            .then(function finalHandler(res) {
              t.equal(res, i, 'should be the correct value')
              checkTransaction(t, agent, transaction)
            })
            .finally(cb)
        })
      }, function() {
        t.end()
      })
    })

    t.test(name + ': preserves transaction in reject callback', function(t) {
      t.plan(3 * COUNT)

      runMultiple(COUNT, function(i, cb) {
        helper.runInTransaction(agent, function transactionWrapper(transaction) {
          var err = new Error('some error ' + i)
          reject(Promise, err)
            .then(function unusedStep() {
              t.fail('should not change execution profile')
            })
            .catch(function catchHandler(reason) {
              t.equal(reason, err, 'should be the same error')
              checkTransaction(t, agent, transaction)
            })
            .finally(cb)
        })
      }, function() {
        t.end()
      })
    })
  }

  t.test('preserves transaction with resolved chained promises', function(t) {
    t.plan(3)

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.resolve(0).then(function step1() {
        return 1
      })
      .then(function step2() {
        return 2
      })
      .then(function finalHandler(res) {
        t.equal(res, 2, 'should be the correct result')
        checkTransaction(t, agent, transaction)
      })
      .finally(function finallyHandler() {
        t.end()
      })
    })
  })

  t.test('preserves transaction with rejected chained promises', function(t) {
    t.plan(3)

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      var err = new Error('some error')
      Promise.resolve(0).then(function step1() {
        return 1
      })
      .then(function rejector() {
        throw err
      })
      .then(function unusedStep() {
        t.fail('should not change execution profile')
      })
      .catch(function catchHandler(reason) {
        t.equal(reason, err, 'should be the same error')
        checkTransaction(t, agent, transaction)
      })
      .finally(function finallyHandler() {
        t.end()
      })
    })
  })
}

function runMultiple(count, fn, cb) {
  var finished = 0
  for (var i = 0; i < count; ++i) {
    fn(i, function runMultipleCallback(){
      if (++finished >= count) {
        cb()
      }
    })
  }
}

function checkTransaction(t, agent, transaction) {
  var currentTransaction = agent.getTransaction()
  t.ok(currentTransaction, 'should be in a transaction')
  if (!currentTransaction) {
    return
  }
  t.equal(currentTransaction.id, transaction.id, 'should be the same transaction')
}
