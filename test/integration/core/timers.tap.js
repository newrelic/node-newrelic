'use strict'

var test = require('tap').test
var timers = require('timers')
var helper = require('../../lib/agent_helper')
var verifySegments = require('./verify.js')

var HAS_SETIMMEDIATE = !!global.setImmediate

test('setTimeout', function testSetTimeout(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper() {
    timers.setTimeout(function anonymous() {
      verifySegments(t, agent, 'timers.setTimeout')
    }, 0)
  })
})

test('setImmediate', function testSetImmediate(t) {
  if (!HAS_SETIMMEDIATE) {
    t.ok('setImmediate not defined')
    return t.end()
  }

  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    timers.setImmediate(function anonymous() {
      t.equal(agent.getTransaction(), transaction)
      t.equal(agent.getTransaction().trace.root.children.length, 0)
      t.end()
    })
  })
})

test('setInterval', function testSetInterval(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper() {
    var interval = timers.setInterval(function anonymous() {
      clearInterval(interval)
      verifySegments(t, agent, 'timers.setInterval')
    }, 10)
  })
})

test('global setTimeout', function testSetTimeout(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper() {
    setTimeout(function anonymous() {
      verifySegments(t, agent, 'timers.setTimeout')
    }, 0)
  })
})

test('global setImmediate', function testSetImmediate(t) {
  if (!HAS_SETIMMEDIATE) {
    t.ok('setImmediate not defined')
    return t.end()
  }

  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    setImmediate(function anonymous() {
      t.equal(agent.getTransaction(), transaction)
      t.equal(agent.getTransaction().trace.root.children.length, 0)
      t.end()
    })
  })
})

test('global setInterval', function testSetInterval(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper() {
    var interval = setInterval(function anonymous() {
      clearInterval(interval)
      verifySegments(t, agent, 'timers.setInterval')
    }, 10)
  })
})

test('nextTick', function testNextTick(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      t.equal(agent.getTransaction(), transaction)
      t.equal(agent.getTransaction().trace.root.children.length, 0)
      t.end()
    })
  })
})

test('nextTick with extra args', function testNextTick(t) {
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


test('clearTimeout', function testNextTick(t) {
  var agent = setupAgent(t)
  var timer = setTimeout(fail)

  clearTimeout(timer)

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      var timer = setTimeout(fail)
      t.notOk(transaction.trace.root.children[0].ignore)
      clearTimeout(timer)
      t.ok(transaction.trace.root.children[0].ignore)
      setTimeout(t.end.bind(t))
    })
  })

  function fail() {
    t.fail()
  }
})

test('clearImmediate', function testNextTick(t) {
  if (!HAS_SETIMMEDIATE) {
    t.ok('setImmediate not defined')
    return t.end()
  }

  var agent = setupAgent(t)
  var timer = setImmediate(fail)

  clearImmediate(timer)

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      var timer = setImmediate(fail)
      t.notOk(transaction.trace.root.children[0])
      clearImmediate(timer)
      setImmediate(t.end.bind(t))
    })
  })

  function fail() {
    t.fail()
  }
})

test('clearTimeout', function testNextTick(t) {
  var agent = setupAgent(t)
  var timer = setTimeout(fail)

  clearTimeout(timer)

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      var timer = setTimeout(fail)
      t.notOk(transaction.trace.root.children[0].ignore)
      clearTimeout(timer)
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
