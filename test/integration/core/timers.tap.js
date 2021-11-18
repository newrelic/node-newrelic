/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const timers = require('timers')
const helper = require('../../lib/agent_helper')
const verifySegments = require('./verify')

tap.test('setTimeout', function testSetTimeout(t) {
  const { agent } = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper() {
    timers.setTimeout(function anonymous() {
      verifySegments(t, agent, 'timers.setTimeout')
    }, 0)
  })
})

tap.test('setImmediate', function testSetImmediate(t) {
  t.autoend()

  t.test('segments', function (t) {
    t.plan(2)
    const { agent } = setupAgent(t)
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

  t.test('async transaction', function (t) {
    t.plan(2)
    const { agent } = setupAgent(t)

    helper.runInTransaction(agent, function (tx) {
      timers.setImmediate(function () {
        t.ok(agent.getTransaction(), 'should be in a transaction')
        t.equal(agent.getTransaction().id, tx.id, 'should be in correct transaction')
      })
    })
  })

  t.test('overlapping transactions', function (t) {
    t.plan(5)
    const { agent } = setupAgent(t)
    let firstTx = null

    helper.runInTransaction(agent, function (tx) {
      firstTx = tx
      check(tx)
    })

    timers.setImmediate(function () {
      helper.runInTransaction(agent, function (tx) {
        t.notEqual(tx.id, firstTx.id, 'should not conflate transactions')
        check(tx)
      })
    })

    function check(tx) {
      timers.setImmediate(function () {
        t.ok(agent.getTransaction(), 'should be in a transaction')
        t.equal(agent.getTransaction().id, tx.id, 'should be in correct transaction')
      })
    }
  })

  t.test('nested setImmediate calls', function (t) {
    t.plan(4)

    const { agent } = setupAgent(t)

    t.notOk(agent.getTransaction(), 'should not start in a transaction')
    helper.runInTransaction(agent, function () {
      setImmediate(function () {
        t.ok(agent.getTransaction(), 'should have transaction in first immediate')
        setImmediate(function () {
          t.ok(agent.getTransaction(), 'should have tx in second immediate')
          setImmediate(function () {
            t.ok(agent.getTransaction(), 'should have tx in third immediate')
          })
        })
      })
    })
  })

  t.test('should not propagate segments for ended transaction', (t) => {
    const { agent, contextManager } = setupAgent(t)

    t.notOk(agent.getTransaction(), 'should not start in a transaction')
    helper.runInTransaction(agent, (transaction) => {
      transaction.end()

      setImmediate(() => {
        t.notOk(contextManager.getContext(), 'should not have segment for ended transaction')
        t.end()
      })
    })
  })
})

tap.test('setInterval', function testSetInterval(t) {
  const { agent } = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper() {
    const interval = timers.setInterval(() => {
      clearInterval(interval)
      verifySegments(t, agent, 'timers.setInterval')
    }, 10)
  })
})

tap.test('global setTimeout', function testSetTimeout(t) {
  const { agent } = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper() {
    setTimeout(function anonymous() {
      verifySegments(t, agent, 'timers.setTimeout')
    }, 0)
  })
})

tap.test('global setImmediate', function testSetImmediate(t) {
  const { agent } = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    setImmediate(function anonymous() {
      t.equal(agent.getTransaction(), transaction)
      t.equal(agent.getTransaction().trace.root.children.length, 0)
      t.end()
    })
  })
})

tap.test('global setInterval', function testSetInterval(t) {
  const { agent } = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper() {
    const interval = setInterval(() => {
      clearInterval(interval)
      verifySegments(t, agent, 'timers.setInterval')
    }, 10)
  })
})

tap.test('nextTick', function testNextTick(t) {
  const { agent } = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      t.equal(agent.getTransaction(), transaction)
      t.equal(agent.getTransaction().trace.root.children.length, 0)
      t.end()
    })
  })
})

tap.test('nextTick with extra args', function testNextTick(t) {
  const original = process.nextTick
  process.nextTick = multiArgNextTick
  const { agent } = setupAgent(t)
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(
      function callback() {
        t.equal(agent.getTransaction(), transaction)
        t.equal(agent.getTransaction().trace.root.children.length, 0)
        t.same([].slice.call(arguments), [1, 2, 3])
        process.nextTick = original
        t.end()
      },
      1,
      2,
      3
    )
  })

  function multiArgNextTick(fn) {
    const args = [].slice.call(arguments, 1)
    original(function callFn() {
      fn.apply(this, args)
    })
  }
})

tap.test('clearImmediate', (t) => {
  const { agent } = setupAgent(t)
  const timer = setImmediate(t.fail)

  clearImmediate(timer)

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      const timer2 = setImmediate(t.fail)
      t.notOk(transaction.trace.root.children[0])
      clearImmediate(timer2)
      setImmediate(t.end.bind(t))
    })
  })
})

tap.test('clearTimeout should function outside of transaction context', (t) => {
  setupAgent(t)

  const timer = setTimeout(t.fail)

  clearTimeout(timer)

  setImmediate(t.end)
})

tap.test('clearTimeout should ignore segment created for timer', (t) => {
  const { agent } = setupAgent(t)

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      const timer = setTimeout(t.fail)

      const timerSegment = transaction.trace.root.children[0]
      t.equal(timerSegment.name, 'timers.setTimeout')
      t.equal(timerSegment.ignore, false)

      clearTimeout(timer)
      t.equal(timerSegment.ignore, true)

      setTimeout(t.end)
    })
  })
})

tap.test('clearTimeout should not ignore parent segment when opaque', (t) => {
  const expectedParentName = 'opaque segment'

  const { agent } = setupAgent(t)

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      helper.runInSegment(agent, expectedParentName, (segment) => {
        segment.opaque = true

        const timer = setTimeout(t.fail)

        const parentSegment = transaction.trace.root.children[0]
        t.equal(parentSegment.name, expectedParentName)
        t.equal(parentSegment.ignore, false)

        clearTimeout(timer)
        t.equal(parentSegment.ignore, false)

        setTimeout(t.end)
      })
    })
  })
})

tap.test('clearTimeout should not ignore parent segment when internal', (t) => {
  const expectedParentName = 'internal segment'

  const { agent } = setupAgent(t)

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      helper.runInSegment(agent, expectedParentName, (segment) => {
        segment.internal = true

        const timer = setTimeout(t.fail)

        const parentSegment = transaction.trace.root.children[0]
        t.equal(parentSegment.name, expectedParentName)
        t.equal(parentSegment.ignore, false)

        clearTimeout(timer)
        t.equal(parentSegment.ignore, false)

        setTimeout(t.end)
      })
    })
  })
})

function setupAgent(t) {
  const agent = helper.instrumentMockedAgent()
  const contextManager = helper.getContextManager()

  t.teardown(function tearDown() {
    helper.unloadAgent(agent)
  })

  return { agent, contextManager }
}
