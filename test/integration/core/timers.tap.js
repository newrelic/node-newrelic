/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var tap = require('tap')
var timers = require('timers')
var helper = require('../../lib/agent_helper')
var verifySegments = require('./verify')


tap.test('setTimeout', function testSetTimeout(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper() {
    timers.setTimeout(function anonymous() {
      verifySegments(t, agent, 'timers.setTimeout')
    }, 0)
  })
})

tap.test('setImmediate', function testSetImmediate(t) {
  t.autoend()

  t.test('segments', function(t) {
    t.plan(2)
    var agent = setupAgent(t)
    helper.runInTransaction(agent, function transactionWrapper(tx) {
      timers.setImmediate(function anonymous() {
        t.equal(agent.getTransaction().id, tx.id, 'should be in expected transaction')
        t.notOk(
          agent.getTransaction().trace.root.children.length,
          'should not have any segment for setImmediate'
        )
      })
    })
  })

  t.test('async transaction', function(t) {
    t.plan(2)
    var agent = setupAgent(t)

    helper.runInTransaction(agent, function(tx) {
      timers.setImmediate(function() {
        t.ok(agent.getTransaction(), 'should be in a transaction')
        t.equal(agent.getTransaction().id, tx.id, 'should be in correct transaction')
      })
    })
  })

  t.test('overlapping transactions', function(t) {
    t.plan(5)
    var agent = setupAgent(t)
    var firstTx = null

    helper.runInTransaction(agent, function(tx) {
      firstTx = tx
      check(tx)
    })

    timers.setImmediate(function() {
      helper.runInTransaction(agent, function(tx) {
        t.notEqual(tx.id, firstTx.id, 'should not conflate transactions')
        check(tx)
      })
    })

    function check(tx) {
      timers.setImmediate(function() {
        t.ok(agent.getTransaction(), 'should be in a transaction')
        t.equal(agent.getTransaction().id, tx.id, 'should be in correct transaction')
      })
    }
  })

  t.test('nested setImmediate calls', function(t) {
    t.plan(4)

    var agent = setupAgent(t)

    t.notOk(agent.getTransaction(), 'should not start in a transaction')
    helper.runInTransaction(agent, function() {
      setImmediate(function() {
        t.ok(agent.getTransaction(), 'should have transaction in first immediate')
        setImmediate(function() {
          t.ok(agent.getTransaction(), 'should have tx in second immediate')
          setImmediate(function() {
            t.ok(agent.getTransaction(), 'should have tx in third immediate')
          })
        })
      })
    })
  })
})

tap.test('setInterval', function testSetInterval(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper() {
    var interval = timers.setInterval(function anonymous() {
      clearInterval(interval)
      verifySegments(t, agent, 'timers.setInterval')
    }, 10)
  })
})

tap.test('global setTimeout', function testSetTimeout(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper() {
    setTimeout(function anonymous() {
      verifySegments(t, agent, 'timers.setTimeout')
    }, 0)
  })
})

tap.test('global setImmediate', function testSetImmediate(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    setImmediate(function anonymous() {
      t.equal(agent.getTransaction(), transaction)
      t.equal(agent.getTransaction().trace.root.children.length, 0)
      t.end()
    })
  })
})

tap.test('global setInterval', function testSetInterval(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper() {
    var interval = setInterval(function anonymous() {
      clearInterval(interval)
      verifySegments(t, agent, 'timers.setInterval')
    }, 10)
  })
})

tap.test('nextTick', function testNextTick(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      t.equal(agent.getTransaction(), transaction)
      t.equal(agent.getTransaction().trace.root.children.length, 0)
      t.end()
    })
  })
})

tap.test('nextTick with extra args', function testNextTick(t) {
  var original = process.nextTick
  process.nextTick = multiArgNextTick
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      t.equal(agent.getTransaction(), transaction)
      t.equal(agent.getTransaction().trace.root.children.length, 0)
      t.deepEqual([].slice.call(arguments), [1, 2, 3])
      process.nextTick = original
      t.end()
    }, 1, 2, 3)
  })

  function multiArgNextTick(fn) {
    var args = [].slice.call(arguments, 1)
    original(function callFn() {
      fn.apply(this, args)
    })
  }
})


tap.test('clearTimeout', function testNextTick(t) {
  var agent = setupAgent(t)
  var timer = setTimeout(fail)

  clearTimeout(timer)

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      var timer2 = setTimeout(fail)
      t.notOk(transaction.trace.root.children[0].ignore)
      clearTimeout(timer2)
      t.ok(transaction.trace.root.children[0].ignore)
      setTimeout(t.end.bind(t))
    })
  })

  function fail() {
    t.fail()
  }
})

tap.test('clearImmediate', function testNextTick(t) {
  var agent = setupAgent(t)
  var timer = setImmediate(fail)

  clearImmediate(timer)

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      var timer2 = setImmediate(fail)
      t.notOk(transaction.trace.root.children[0])
      clearImmediate(timer2)
      setImmediate(t.end.bind(t))
    })
  })

  function fail() {
    t.fail()
  }
})

tap.test('clearTimeout', function testNextTick(t) {
  var agent = setupAgent(t)
  var timer = setTimeout(fail)

  clearTimeout(timer)

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      var timer2 = setTimeout(fail)
      t.notOk(transaction.trace.root.children[0].ignore)
      clearTimeout(timer2)
      t.ok(transaction.trace.root.children[0].ignore)
      setTimeout(t.end.bind(t))
    })
  })

  function fail() {
    t.fail()
  }
})

function setupAgent(t) {
  var agent = helper.instrumentMockedAgent()
  t.tearDown(function tearDown() {
    helper.unloadAgent(agent)
  })

  return agent
}
