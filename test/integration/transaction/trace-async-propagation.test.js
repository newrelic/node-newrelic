/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { EventEmitter } = require('events')
const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const helper = require('../../lib/agent_helper')

test('asynchronous state propagation', async function (t) {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('a. async transaction with setTimeout', async function (t) {
    const { agent } = t.nr
    const plan = tspl(t, { plan: 2 })

    function handler() {
      plan.ok(agent.getTransaction(), 'transaction should be visible')
    }

    plan.ok(!agent.getTransaction(), 'transaction should not yet be visible')
    helper.runInTransaction(agent, function () {
      setTimeout(handler, 100)
    })

    await plan.completed
  })

  await t.test('b. async transaction with setInterval', async function (t) {
    const { agent } = t.nr
    const plan = tspl(t, { plan: 4 })

    let count = 0
    let handle

    function handler() {
      count += 1
      if (count > 2) {
        clearInterval(handle)
      }
      plan.ok(agent.getTransaction(), 'transaction should be visible')
    }

    plan.ok(!agent.getTransaction(), 'transaction should not yet be visible')
    helper.runInTransaction(agent, function () {
      handle = setInterval(handler, 50)
    })

    await plan.completed
  })

  await t.test('c. async transaction with process.nextTick', async function (t) {
    const { agent } = t.nr
    const plan = tspl(t, { plan: 2 })

    function handler() {
      plan.ok(agent.getTransaction(), 'transaction should be visible')
    }

    plan.ok(!agent.getTransaction(), 'transaction should not yet be visible')
    helper.runInTransaction(agent, function () {
      process.nextTick(handler)
    })

    await plan.completed
  })

  await t.test('d. async transaction with EventEmitter.prototype.emit', async function (t) {
    const { agent } = t.nr
    const plan = tspl(t, { plan: 2 })

    const ee = new EventEmitter()

    function handler() {
      plan.ok(agent.getTransaction(), 'transaction should be visible')
    }

    plan.ok(!agent.getTransaction(), 'transaction should not yet be visible')
    helper.runInTransaction(agent, function () {
      ee.on('transaction', handler)
      ee.emit('transaction')
    })

    await plan.completed
  })

  await t.test(
    'e. two overlapping runs of an async transaction with setTimeout',
    async function (t) {
      const { agent } = t.nr
      const plan = tspl(t, { plan: 6 })

      let first
      let second

      function handler(id) {
        plan.ok(agent.getTransaction(), 'transaction should be visible')
        plan.equal(agent.getTransaction().id, id, 'transaction matches')
      }

      plan.ok(!agent.getTransaction(), 'transaction should not yet be visible')
      helper.runInTransaction(agent, function () {
        first = agent.getTransaction().id
        setTimeout(handler.bind(null, first), 100)
      })

      setTimeout(function () {
        helper.runInTransaction(agent, function () {
          second = agent.getTransaction().id
          plan.notEqual(first, second, 'different transaction IDs')
          setTimeout(handler.bind(null, second), 100)
        })
      }, 25)

      await plan.completed
    }
  )

  await t.test(
    'f. two overlapping runs of an async transaction with setInterval',
    async function (t) {
      const { agent } = t.nr
      const plan = tspl(t, { plan: 15 })

      function runInterval() {
        let count = 0
        let handle
        let id

        function handler() {
          count += 1
          if (count > 2) {
            clearInterval(handle)
          }
          plan.ok(agent.getTransaction(), 'transaction should be visible')
          plan.equal(id, agent.getTransaction().id, 'transaction ID should be immutable')
        }

        function run() {
          plan.ok(agent.getTransaction(), 'transaction should have been created')
          id = agent.getTransaction().id
          handle = setInterval(handler, 50)
        }

        helper.runInTransaction(agent, run)
      }

      plan.ok(!agent.getTransaction(), 'transaction should not yet be visible')
      runInterval()
      runInterval()
      await plan.completed
    }
  )

  await t.test(
    'g. two overlapping runs of an async transaction with process.nextTick',
    async function (t) {
      const { agent } = t.nr
      const plan = tspl(t, { plan: 6 })

      let first
      let second

      function handler(id) {
        const transaction = agent.getTransaction()
        plan.ok(transaction, 'transaction should be visible')
        plan.equal((transaction || {}).id, id, 'transaction matches')
      }

      plan.ok(!agent.getTransaction(), 'transaction should not yet be visible')
      helper.runInTransaction(agent, function () {
        first = agent.getTransaction().id
        process.nextTick(handler.bind(null, first))
      })

      process.nextTick(function cbNextTick() {
        helper.runInTransaction(agent, function () {
          second = agent.getTransaction().id
          plan.notEqual(first, second, 'different transaction IDs')
          process.nextTick(handler.bind(null, second))
        })
      })
      await plan.completed
    }
  )

  await t.test(
    'h. two overlapping async runs with EventEmitter.prototype.emit',
    async function (t) {
      const { agent } = t.nr
      const plan = tspl(t, { plan: 3 })

      const ee = new EventEmitter()

      function handler() {
        plan.ok(agent.getTransaction(), 'transaction should be visible')
      }

      function lifecycle() {
        ee.once('transaction', process.nextTick.bind(process, handler))
        ee.emit('transaction')
      }

      plan.ok(!agent.getTransaction(), 'transaction should not yet be visible')
      helper.runInTransaction(agent, lifecycle)
      helper.runInTransaction(agent, lifecycle)
      await plan.completed
    }
  )

  await t.test('i. async transaction with an async sub-call with setTimeout', async function (t) {
    const { agent } = t.nr
    const plan = tspl(t, { plan: 5 })

    function inner(callback) {
      setTimeout(function () {
        plan.ok(agent.getTransaction(), 'transaction should -- yep -- still be visible')
        callback()
      }, 50)
    }

    function outer() {
      plan.ok(agent.getTransaction(), 'transaction should be visible')
      setTimeout(function () {
        plan.ok(agent.getTransaction(), 'transaction should still be visible')
        inner(function () {
          plan.ok(agent.getTransaction(), 'transaction should even still be visible')
        })
      }, 50)
    }

    plan.ok(!agent.getTransaction(), 'transaction should not yet be visible')
    helper.runInTransaction(agent, setTimeout.bind(null, outer, 50))
    await plan.completed
  })

  await t.test('j. async transaction with an async sub-call with setInterval', async function (t) {
    const { agent } = t.nr
    const plan = tspl(t, { plan: 5 })

    let outerHandle
    let innerHandle

    function inner(callback) {
      innerHandle = setInterval(function () {
        clearInterval(innerHandle)
        plan.ok(agent.getTransaction(), 'transaction should -- yep -- still be visible')
        callback()
      }, 50)
    }

    function outer() {
      plan.ok(agent.getTransaction(), 'transaction should be visible')
      outerHandle = setInterval(function () {
        clearInterval(outerHandle)
        plan.ok(agent.getTransaction(), 'transaction should still be visible')
        inner(function () {
          plan.ok(agent.getTransaction(), 'transaction should even still be visible')
        })
      }, 50)
    }

    plan.ok(!agent.getTransaction(), 'transaction should not yet be visible')
    helper.runInTransaction(agent, outer)
    await plan.completed
  })

  await t.test(
    'k. async transaction with an async sub-call with process.nextTick',
    async function (t) {
      const { agent } = t.nr
      const plan = tspl(t, { plan: 5 })

      function inner(callback) {
        process.nextTick(function cbNextTick() {
          plan.ok(agent.getTransaction(), 'transaction should -- yep -- still be visible')
          callback()
        })
      }

      function outer() {
        plan.ok(agent.getTransaction(), 'transaction should be visible')
        process.nextTick(function cbNextTick() {
          plan.ok(agent.getTransaction(), 'transaction should still be visible')
          inner(function () {
            plan.ok(agent.getTransaction(), 'transaction should even still be visible')
          })
        })
      }

      plan.ok(!agent.getTransaction(), 'transaction should not yet be visible')
      /* This used to use process.nextTick.bind(process, outer), but CLS will
       * capture the wrong context (before the transaction is created) if you bind
       * in the parameter list instead of within helper.runInTransaction's callback.
       * There may be a subtle bug in CLS lurking here.
       */
      helper.runInTransaction(agent, function () {
        process.nextTick(outer)
      })
      await plan.completed
    }
  )

  await t.test(
    'l. async transaction with an async sub-call with EventEmitter.prototype.emit',
    async function (t) {
      const { agent } = t.nr
      const plan = tspl(t, { plan: 4 })

      const outer = new EventEmitter()
      const inner = new EventEmitter()

      inner.on('pong', function (callback) {
        plan.ok(agent.getTransaction(), 'transaction should still be visible')
        callback()
      })

      function outerCallback() {
        plan.ok(agent.getTransaction(), 'transaction should even still be visible')
      }

      outer.on('ping', function () {
        plan.ok(agent.getTransaction(), 'transaction should be visible')
        inner.emit('pong', outerCallback)
      })

      plan.ok(!agent.getTransaction(), 'transaction should not yet be visible')
      helper.runInTransaction(agent, outer.emit.bind(outer, 'ping'))
      await plan.completed
    }
  )
})
