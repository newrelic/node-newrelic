/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { tspl } = require('@matteo.collina/tspl')
const timers = require('timers')
const helper = require('../../lib/agent_helper')
const verifySegments = require('./verify')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('setTimeout', function testSetTimeout(t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function transactionWrapper() {
    timers.setTimeout(function anonymous() {
      verifySegments({ agent, end, name: 'timers.setTimeout' })
    }, 0)
  })
})

test('setImmediate: segments', async function (t) {
  const plan = tspl(t, { plan: 2 })
  const { agent } = t.nr
  helper.runInTransaction(agent, function transactionWrapper(tx) {
    timers.setImmediate(function anonymous() {
      plan.equal(agent.getTransaction().id, tx.id, 'should be in expected transaction')
      plan.ok(
        !agent.getTransaction().trace.root.children.length,
        'should not have any segment for setImmediate'
      )
    })
  })

  await plan.completed
})

test('setImmediate: async transaction', async function (t) {
  const plan = tspl(t, { plan: 2 })
  const { agent } = t.nr

  helper.runInTransaction(agent, function (tx) {
    timers.setImmediate(function () {
      plan.ok(agent.getTransaction(), 'should be in a transaction')
      plan.equal(agent.getTransaction().id, tx.id, 'should be in correct transaction')
    })
  })

  await plan.completed
})

test('setImmediate: overlapping transactions', async function (t) {
  const plan = tspl(t, { plan: 5 })
  const { agent } = t.nr
  let firstTx = null

  helper.runInTransaction(agent, function (tx) {
    firstTx = tx
    check(tx)
  })

  timers.setImmediate(function () {
    helper.runInTransaction(agent, function (tx) {
      plan.notEqual(tx.id, firstTx.id, 'should not conflate transactions')
      check(tx)
    })
  })

  function check(tx) {
    timers.setImmediate(function () {
      plan.ok(agent.getTransaction(), 'should be in a transaction')
      plan.equal(agent.getTransaction().id, tx.id, 'should be in correct transaction')
    })
  }
  await plan.completed
})

test('setImmediate: nested calls', async function (t) {
  const plan = tspl(t, { plan: 4 })

  const { agent } = t.nr

  plan.ok(!agent.getTransaction(), 'should not start in a transaction')
  helper.runInTransaction(agent, function () {
    setImmediate(function () {
      plan.ok(agent.getTransaction(), 'should have transaction in first immediate')
      setImmediate(function () {
        plan.ok(agent.getTransaction(), 'should have tx in second immediate')
        setImmediate(function () {
          plan.ok(agent.getTransaction(), 'should have tx in third immediate')
        })
      })
    })
  })

  await plan.completed
})

test('setImmediate: should not propagate segments for ended transaction', async (t) => {
  const plan = tspl(t, { plan: 5 })
  const { agent } = t.nr

  plan.ok(!agent.getTransaction(), 'should not start in a transaction')
  helper.runInTransaction(agent, (transaction) => {
    transaction.end()

    helper.runInSegment(agent, 'test-segment', () => {
      const segment = agent.tracer.getSegment()
      plan.notEqual(segment.name, 'test-segment')
      plan.equal(segment.children.length, 0, 'should not propagate segments when transaction ends')
      setImmediate(() => {
        const segment = agent.tracer.getSegment()
        plan.notEqual(segment.name, 'test-segment')
        plan.equal(
          segment.children.length,
          0,
          'should not propagate segments when transaction ends'
        )
      })
    })
  })

  await plan.completed
})

test('setInterval', function testSetInterval(t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function transactionWrapper() {
    const interval = timers.setInterval(() => {
      clearInterval(interval)
      verifySegments({ agent, end, name: 'timers.setInterval' })
    }, 10)
  })
})

test('global setTimeout', function testSetTimeout(t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function transactionWrapper() {
    setTimeout(function anonymous() {
      verifySegments({ agent, end, name: 'timers.setTimeout' })
    }, 0)
  })
})

test('global setImmediate', function testSetImmediate(t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    setImmediate(function anonymous() {
      assert.equal(agent.getTransaction(), transaction)
      assert.equal(agent.getTransaction().trace.root.children.length, 0)
      end()
    })
  })
})

test('global setInterval', function testSetInterval(t, end) {
  const { agent } = t.nr
  helper.runInTransaction(agent, function transactionWrapper() {
    const interval = setInterval(() => {
      clearInterval(interval)
      verifySegments({ agent, end, name: 'timers.setInterval' })
    }, 10)
  })
})

test('nextTick', async function testNextTick(t) {
  const plan = tspl(t, { plan: 2 })
  const { agent } = t.nr
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      plan.equal(agent.getTransaction(), transaction)
      plan.equal(agent.getTransaction().trace.root.children.length, 0)
    })
  })

  await plan.completed
})

test('nextTick with extra args', async function testNextTick(t) {
  const plan = tspl(t, { plan: 3 })
  const original = process.nextTick
  process.nextTick = multiArgNextTick
  const { agent } = t.nr
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(
      function callback() {
        plan.equal(agent.getTransaction(), transaction)
        plan.equal(agent.getTransaction().trace.root.children.length, 0)
        plan.deepEqual([].slice.call(arguments), [1, 2, 3])
        process.nextTick = original
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

  await plan.completed
})

test('clearImmediate', (t, end) => {
  const { agent } = t.nr
  const timer = setImmediate(assert.fail)

  clearImmediate(timer)

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      const timer2 = setImmediate(assert.fail)
      assert.ok(!transaction.trace.root.children[0])
      clearImmediate(timer2)
      setImmediate(end)
    })
  })
})

test('clearTimeout should function outside of transaction context', (t, end) => {
  const timer = setTimeout(assert.fail)

  clearTimeout(timer)

  setImmediate(end)
})

test('clearTimeout should ignore segment created for timer', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const { agent } = t.nr

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      const timer = setTimeout(plan.fail)

      const timerSegment = transaction.trace.root.children[0]
      plan.equal(timerSegment.name, 'timers.setTimeout')
      plan.equal(timerSegment.ignore, false)

      clearTimeout(timer)
      plan.equal(timerSegment.ignore, true)
    })
  })

  await plan.completed
})

test('clearTimeout should not ignore parent segment when opaque', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const expectedParentName = 'opaque segment'

  const { agent } = t.nr

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      helper.runInSegment(agent, expectedParentName, (segment) => {
        segment.opaque = true

        const timer = setTimeout(plan.fail)
        const parentSegment = transaction.trace.root.children[0]
        plan.equal(parentSegment.name, expectedParentName)
        plan.equal(parentSegment.ignore, false)

        clearTimeout(timer)
        plan.equal(parentSegment.ignore, false)
      })
    })
  })

  await plan.completed
})

test('clearTimeout should not ignore parent segment when internal', async (t) => {
  const plan = tspl(t, { plan: 3 })
  const expectedParentName = 'internal segment'

  const { agent } = t.nr

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    process.nextTick(function callback() {
      helper.runInSegment(agent, expectedParentName, (segment) => {
        segment.internal = true

        const timer = setTimeout(plan.fail)

        const parentSegment = transaction.trace.root.children[0]
        plan.equal(parentSegment.name, expectedParentName)
        plan.equal(parentSegment.ignore, false)

        clearTimeout(timer)
        plan.equal(parentSegment.ignore, false)
      })
    })
  })

  await plan.completed
})
