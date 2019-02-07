'use strict'

var helper = require('../../../lib/agent_helper')

var COUNT = 2

module.exports = runTests
runTests.runMultiple = runMultiple


function runTests(t, agent, Promise, library) {
  /* eslint-disable no-shadow, brace-style */
  if (library) {
    performTests('Library Fullfillment Factories',
      function(Promise, val) { return library.resolve(val) },
      function(Promise, err) { return library.reject(err) }
    )
  }

  performTests('Promise Fullfillment Factories',
    function(Promise, val) { return Promise.resolve(val) },
    function(Promise, err) { return Promise.reject(err) }
  )

  performTests('New Synchronous',
    function(Promise, val) { return new Promise(function(res) { res(val) }) },
    function(Promise, err) { return new Promise(function(res, rej) { rej(err) }) }
  )

  performTests('New Asynchronous',
    function(Promise, val) {
      return new Promise(function(res) {
        setTimeout(function() { res(val) }, 10)
      })
    },
    function(Promise, err) {
      return new Promise(function(res, rej) {
        setTimeout(function() { rej(err) }, 10)
      })
    }
  )

  if (Promise.method) {
    performTests('Promise.method',
      function(Promise, val) { return Promise.method(function() { return val })() },
      function(Promise, err) { return Promise.method(function() { throw err })() }
    )
  }

  if (Promise.try) {
    performTests('Promise.try',
      function(Promise, val) { return Promise.try(function() { return val }) },
      function(Promise, err) { return Promise.try(function() { throw err }) }
    )
  }
  /* eslint-enable no-shadow, brace-style */

  function performTests(name, resolve, reject) {
    doPerformTests(name, resolve, reject, true)
    doPerformTests(name, resolve, reject, false)
  }

  function doPerformTests(name, resolve, reject, inTx) {
    name += ' ' + (inTx ? 'with' : 'without') + ' transaction'

    t.test(name + ': does not cause JSON to crash', function(t) {
      t.plan(1 * COUNT + 1)
      agent.config.transaction_tracer.hide_internals = true

      runMultiple(COUNT, function(i, cb) {
        if (inTx) {
          helper.runInTransaction(agent, test)
        } else {
          test(null)
        }

        function test(transaction) {
          var p = resolve(Promise).then(end(transaction, cb), end(transaction, cb))
          var d = p.domain
          delete p.domain
          t.doesNotThrow(function() {
            JSON.stringify(p)
          }, 'should not cause stringification to crash')
          p.domain = d
        }
      }, function(err) {
        t.error(err, 'should not error')
        t.end()
      })
    })

    t.test(name + ': preserves transaction in resolve callback', function(t) {
      t.plan(4 * COUNT + 1)

      runMultiple(COUNT, function(i, cb) {
        if (inTx) {
          helper.runInTransaction(agent, test)
        } else {
          test(null)
        }

        function test(transaction) {
          resolve(Promise)
            .then(function step() {
              t.pass('should not change execution profile')
              return i
            })
            .then(function finalHandler(res) {
              t.equal(res, i, 'should be the correct value')
              checkTransaction(t, agent, transaction)
            })
            .then(end(transaction, cb), end(transaction, cb))
        }
      }, function(err) {
        t.error(err, 'should not error')
        t.end()
      })
    })

    t.test(name + ': preserves transaction in reject callback', function(t) {
      t.plan(3 * COUNT + 1)

      runMultiple(COUNT, function(i, cb) {
        if (inTx) {
          helper.runInTransaction(agent, test)
        } else {
          test(null)
        }

        function test(transaction) {
          var err = new Error('some error ' + i)
          reject(Promise, err)
            .then(function unusedStep() {
              t.fail('should not change execution profile')
            })
            .catch(function catchHandler(reason) {
              t.equal(reason, err, 'should be the same error')
              checkTransaction(t, agent, transaction)
            })
            .then(end(transaction, cb), end(transaction, cb))
        }
      }, function(err) {
        t.error(err, 'should not error')
        t.end()
      })
    })
  }

  t.test('preserves transaction with resolved chained promises', function(t) {
    t.plan(4)

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.resolve(0).then(function step1() {
        return 1
      }).then(function step2() {
        return 2
      }).then(function finalHandler(res) {
        t.equal(res, 2, 'should be the correct result')
        checkTransaction(t, agent, transaction)
        transaction.end()
      }).then(function() {
        t.pass('should resolve cleanly')
        t.end()
      }, function(err) {
        t.fail(err)
        t.end()
      })
    })
  })

  t.test('preserves transaction with rejected chained promises', function(t) {
    t.plan(4)

    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      var err = new Error('some error')
      Promise.resolve(0).then(function step1() {
        return 1
      }).then(function rejector() {
        throw err
      }).then(function unusedStep() {
        t.fail('should not change execution profile')
      }).catch(function catchHandler(reason) {
        t.equal(reason, err, 'should be the same error')
        checkTransaction(t, agent, transaction)
        transaction.end()
      }).then(function finallyHandler() {
        t.pass('should resolve cleanly')
        t.end()
      }, function(err) {
        t.fail(err)
        t.end()
      })
    })
  })
}

function runMultiple(count, fn, cb) {
  var finished = 0
  for (var i = 0; i < count; ++i) {
    fn(i, function runMultipleCallback() {
      if (++finished >= count) {
        cb()
      }
    })
  }
}

function checkTransaction(t, agent, transaction) {
  var currentTransaction = agent.getTransaction()

  if (transaction) {
    t.ok(currentTransaction, 'should be in a transaction')
    if (!currentTransaction) {
      return
    }
    t.equal(currentTransaction.id, transaction.id, 'should be the same transaction')
  } else {
    t.notOk(currentTransaction, 'should not be in a transaction')
    t.pass('') // Make test count match for both branches.
  }
}

function end(tx, cb) {
  return function() {
    if (tx) {
      tx.end()
    }
    cb()
  }
}
