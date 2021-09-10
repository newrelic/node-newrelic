/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const EventEmitter = require('events').EventEmitter
const tap = require('tap')
const test = tap.test
const helper = require('../../lib/agent_helper')

test('asynchronous state propagation', function (t) {
  t.plan(12)

  t.test('a. async transaction with setTimeout', { timeout: 5000 }, function (t) {
    t.plan(2)

    const agent = helper.instrumentMockedAgent()

    t.teardown(() => {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) {
        agent.getTransaction().end()
      }
      helper.unloadAgent(agent)
    })

    function handler() {
      t.ok(agent.getTransaction(), 'transaction should be visible')
    }

    t.notOk(agent.getTransaction(), 'transaction should not yet be visible')
    helper.runInTransaction(agent, function () {
      setTimeout(handler, 100)
    })
  })

  t.test('b. async transaction with setInterval', { timeout: 5000 }, function (t) {
    t.plan(4)

    let count = 0
    const agent = helper.instrumentMockedAgent()
    let handle

    t.teardown(() => {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) {
        agent.getTransaction().end()
      }
      helper.unloadAgent(agent)
    })

    function handler() {
      count += 1
      if (count > 2) {
        clearInterval(handle)
      }
      t.ok(agent.getTransaction(), 'transaction should be visible')
    }

    t.notOk(agent.getTransaction(), 'transaction should not yet be visible')
    helper.runInTransaction(agent, function () {
      handle = setInterval(handler, 50)
    })
  })

  t.test('c. async transaction with process.nextTick', { timeout: 5000 }, function (t) {
    t.plan(2)

    const agent = helper.instrumentMockedAgent()

    t.teardown(() => {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) {
        agent.getTransaction().end()
      }
      helper.unloadAgent(agent)
    })

    function handler() {
      t.ok(agent.getTransaction(), 'transaction should be visible')
    }

    t.notOk(agent.getTransaction(), 'transaction should not yet be visible')
    helper.runInTransaction(agent, function () {
      process.nextTick(handler)
    })
  })

  t.test('d. async transaction with EventEmitter.prototype.emit', { timeout: 5000 }, function (t) {
    t.plan(2)

    const agent = helper.instrumentMockedAgent()
    const ee = new EventEmitter()

    t.teardown(() => {
      // FIXME: why does CLS keep the transaction?
      if (agent.getTransaction()) {
        agent.getTransaction().end()
      }
      helper.unloadAgent(agent)
    })

    function handler() {
      t.ok(agent.getTransaction(), 'transaction should be visible')
    }

    t.notOk(agent.getTransaction(), 'transaction should not yet be visible')
    helper.runInTransaction(agent, function () {
      ee.on('transaction', handler)
      ee.emit('transaction')
    })
  })

  t.test(
    'e. two overlapping runs of an async transaction with setTimeout',
    { timeout: 5000 },
    function (t) {
      t.plan(6)

      let first
      let second
      const agent = helper.instrumentMockedAgent()

      t.teardown(() => {
        // FIXME: why does CLS keep the transaction?
        if (agent.getTransaction()) {
          agent.getTransaction().end()
        }
        helper.unloadAgent(agent)
      })

      function handler(id) {
        t.ok(agent.getTransaction(), 'transaction should be visible')
        t.equal(agent.getTransaction().id, id, 'transaction matches')
      }

      t.notOk(agent.getTransaction(), 'transaction should not yet be visible')
      helper.runInTransaction(agent, function () {
        first = agent.getTransaction().id
        setTimeout(handler.bind(null, first), 100)
      })

      setTimeout(function () {
        helper.runInTransaction(agent, function () {
          second = agent.getTransaction().id
          t.notEqual(first, second, 'different transaction IDs')
          setTimeout(handler.bind(null, second), 100)
        })
      }, 25)
    }
  )

  t.test(
    'f. two overlapping runs of an async transaction with setInterval',
    { timeout: 5000 },
    function (t) {
      t.plan(15)

      const agent = helper.instrumentMockedAgent()

      t.teardown(() => {
        // FIXME: why does CLS keep the transaction?
        if (agent.getTransaction()) {
          agent.getTransaction().end()
        }
        helper.unloadAgent(agent)
      })

      function runInterval() {
        let count = 0
        let handle
        let id

        function handler() {
          count += 1
          if (count > 2) {
            clearInterval(handle)
          }
          t.ok(agent.getTransaction(), 'transaction should be visible')
          t.equal(id, agent.getTransaction().id, 'transaction ID should be immutable')
        }

        function run() {
          t.ok(agent.getTransaction(), 'transaction should have been created')
          id = agent.getTransaction().id
          handle = setInterval(handler, 50)
        }

        helper.runInTransaction(agent, run)
      }

      t.notOk(agent.getTransaction(), 'transaction should not yet be visible')
      runInterval()
      runInterval()
    }
  )

  t.test(
    'g. two overlapping runs of an async transaction with process.nextTick',
    { timeout: 5000 },
    function (t) {
      t.plan(6)

      let first
      let second
      const agent = helper.instrumentMockedAgent()

      t.teardown(() => {
        // FIXME: why does CLS keep the transaction?
        if (agent.getTransaction()) {
          agent.getTransaction().end()
        }
        helper.unloadAgent(agent)
      })

      function handler(id) {
        const transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal((transaction || {}).id, id, 'transaction matches')
      }

      t.notOk(agent.getTransaction(), 'transaction should not yet be visible')
      helper.runInTransaction(agent, function () {
        first = agent.getTransaction().id
        process.nextTick(handler.bind(null, first))
      })

      process.nextTick(function cbNextTick() {
        helper.runInTransaction(agent, function () {
          second = agent.getTransaction().id
          t.notEqual(first, second, 'different transaction IDs')
          process.nextTick(handler.bind(null, second))
        })
      })
    }
  )

  t.test(
    'h. two overlapping async runs with EventEmitter.prototype.emit',
    { timeout: 5000 },
    function (t) {
      t.plan(3)

      const agent = helper.instrumentMockedAgent()
      const ee = new EventEmitter()

      t.teardown(() => {
        // FIXME: why does CLS keep the transaction?
        if (agent.getTransaction()) {
          agent.getTransaction().end()
        }
        helper.unloadAgent(agent)
      })

      function handler() {
        t.ok(agent.getTransaction(), 'transaction should be visible')
      }

      function lifecycle() {
        ee.once('transaction', process.nextTick.bind(process, handler))
        ee.emit('transaction')
      }

      t.notOk(agent.getTransaction(), 'transaction should not yet be visible')
      helper.runInTransaction(agent, lifecycle)
      helper.runInTransaction(agent, lifecycle)
    }
  )

  t.test(
    'i. async transaction with an async sub-call with setTimeout',
    { timeout: 5000 },
    function (t) {
      t.plan(5)

      const agent = helper.instrumentMockedAgent()

      t.teardown(() => {
        // FIXME: why does CLS keep the transaction?
        if (agent.getTransaction()) {
          agent.getTransaction().end()
        }
        helper.unloadAgent(agent)
      })

      function inner(callback) {
        setTimeout(function () {
          t.ok(agent.getTransaction(), 'transaction should -- yep -- still be visible')
          callback()
        }, 50)
      }

      function outer() {
        t.ok(agent.getTransaction(), 'transaction should be visible')
        setTimeout(function () {
          t.ok(agent.getTransaction(), 'transaction should still be visible')
          inner(function () {
            t.ok(agent.getTransaction(), 'transaction should even still be visible')
          })
        }, 50)
      }

      t.notOk(agent.getTransaction(), 'transaction should not yet be visible')
      helper.runInTransaction(agent, setTimeout.bind(null, outer, 50))
    }
  )

  t.test(
    'j. async transaction with an async sub-call with setInterval',
    { timeout: 5000 },
    function (t) {
      t.plan(5)

      const agent = helper.instrumentMockedAgent()
      let outerHandle
      let innerHandle

      t.teardown(() => {
        // FIXME: why does CLS keep the transaction?
        if (agent.getTransaction()) {
          agent.getTransaction().end()
        }
        helper.unloadAgent(agent)
      })

      function inner(callback) {
        innerHandle = setInterval(function () {
          clearInterval(innerHandle)
          t.ok(agent.getTransaction(), 'transaction should -- yep -- still be visible')
          callback()
        }, 50)
      }

      function outer() {
        t.ok(agent.getTransaction(), 'transaction should be visible')
        outerHandle = setInterval(function () {
          clearInterval(outerHandle)
          t.ok(agent.getTransaction(), 'transaction should still be visible')
          inner(function () {
            t.ok(agent.getTransaction(), 'transaction should even still be visible')
          })
        }, 50)
      }

      t.notOk(agent.getTransaction(), 'transaction should not yet be visible')
      helper.runInTransaction(agent, outer)
    }
  )

  t.test(
    'k. async transaction with an async sub-call with process.nextTick',
    { timeout: 5000 },
    function (t) {
      t.plan(5)

      const agent = helper.instrumentMockedAgent()

      t.teardown(() => {
        // FIXME: why does CLS keep the transaction?
        if (agent.getTransaction()) {
          agent.getTransaction().end()
        }
        helper.unloadAgent(agent)
      })

      function inner(callback) {
        process.nextTick(function cbNextTick() {
          t.ok(agent.getTransaction(), 'transaction should -- yep -- still be visible')
          callback()
        })
      }

      function outer() {
        t.ok(agent.getTransaction(), 'transaction should be visible')
        process.nextTick(function cbNextTick() {
          t.ok(agent.getTransaction(), 'transaction should still be visible')
          inner(function () {
            t.ok(agent.getTransaction(), 'transaction should even still be visible')
          })
        })
      }

      t.notOk(agent.getTransaction(), 'transaction should not yet be visible')
      /* This used to use process.nextTick.bind(process, outer), but CLS will
       * capture the wrong context (before the transaction is created) if you bind
       * in the parameter list instead of within helper.runInTransaction's callback.
       * There may be a subtle bug in CLS lurking here.
       */
      helper.runInTransaction(agent, function () {
        process.nextTick(outer)
      })
    }
  )

  t.test(
    'l. async transaction with an async sub-call with EventEmitter.prototype.emit',
    { timeout: 5000 },
    function (t) {
      t.plan(4)

      const agent = helper.instrumentMockedAgent()
      const outer = new EventEmitter()
      const inner = new EventEmitter()

      t.teardown(() => {
        // FIXME: why does CLS keep the transaction?
        if (agent.getTransaction()) {
          agent.getTransaction().end()
        }
        helper.unloadAgent(agent)
      })

      inner.on('pong', function (callback) {
        t.ok(agent.getTransaction(), 'transaction should still be visible')
        callback()
      })

      function outerCallback() {
        t.ok(agent.getTransaction(), 'transaction should even still be visible')
      }

      outer.on('ping', function () {
        t.ok(agent.getTransaction(), 'transaction should be visible')
        inner.emit('pong', outerCallback)
      })

      t.notOk(agent.getTransaction(), 'transaction should not yet be visible')
      helper.runInTransaction(agent, outer.emit.bind(outer, 'ping'))
    }
  )
})
