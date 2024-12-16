/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const { tspl } = require('@matteo.collina/tspl')
const { createHook, checkCallMetrics, TestResource } = require('./promise-utils')

test('AsyncLocalStorage based tracking', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
    ctx.nr.tracer = helper.getTracer()
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('maintains context across await', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function (txn) {
      let transaction = agent.getTransaction()
      assert.equal(transaction && transaction.id, txn.id, 'should start in a transaction')

      await Promise.resolve("i'll be back")

      transaction = agent.getTransaction()
      assert.equal(
        transaction && transaction.id,
        txn.id,
        'should resume in the same transaction after await'
      )

      txn.end()
    })
  })

  await t.test('maintains context across multiple awaits', async (t) => {
    const { agent } = t.nr
    await helper.runInTransaction(agent, async function (createdTransaction) {
      let transaction = agent.getTransaction()
      assert.equal(
        transaction && transaction.id,
        createdTransaction.id,
        'should start in a transaction'
      )

      await firstFunction()
      transaction = agent.getTransaction()
      assert.equal(transaction && transaction.id, createdTransaction.id)

      await secondFunction()
      transaction = agent.getTransaction()
      assert.equal(transaction && transaction.id, createdTransaction.id)

      createdTransaction.end()

      async function firstFunction() {
        await childFunction()

        transaction = agent.getTransaction()
        assert.equal(transaction && transaction.id, createdTransaction.id)
      }

      async function childFunction() {
        await new Promise((resolve) => {
          transaction = agent.getTransaction()
          assert.equal(transaction && transaction.id, createdTransaction.id)

          setTimeout(resolve, 1)
        })
      }

      async function secondFunction() {
        await new Promise((resolve) => {
          setImmediate(resolve)
        })
      }
    })
  })

  await t.test('maintains context across promise chain', async (t) => {
    const { agent } = t.nr
    await helper.runInTransaction(agent, function (createdTransaction) {
      let transaction = agent.getTransaction()
      assert.equal(
        transaction && transaction.id,
        createdTransaction.id,
        'should start in a transaction'
      )
      return firstFunction()
        .then(() => {
          transaction = agent.getTransaction()
          assert.equal(transaction && transaction.id, createdTransaction.id)
          return secondFunction()
        })
        .then(() => {
          transaction = agent.getTransaction()
          assert.equal(transaction && transaction.id, createdTransaction.id)
          createdTransaction.end()
        })

      function firstFunction() {
        return childFunction()
      }

      function childFunction() {
        return new Promise((resolve) => {
          transaction = agent.getTransaction()
          assert.equal(transaction && transaction.id, createdTransaction.id)

          setTimeout(resolve, 1)
        })
      }

      function secondFunction() {
        return new Promise((resolve) => {
          setImmediate(resolve)
        })
      }
    })
  })

  await t.test('does not crash on multiple resolve calls', async function (t) {
    const { agent } = t.nr
    await helper.runInTransaction(agent, function () {
      let promise = null
      assert.doesNotThrow(function () {
        promise = new Promise(function (res) {
          res()
          res()
        })
      })
      return promise
    })
  })

  await t.test('restores context in inactive transactions', async function (t) {
    const plan = tspl(t, { plan: 1 })
    const { agent, tracer } = t.nr

    helper.runInTransaction(agent, function (txn) {
      const res = new TestResource(1)
      const root = tracer.getSegment()
      txn.end()
      res.doStuff(function () {
        plan.equal(
          tracer.getSegment(),
          root,
          'should restore a segment when its transaction has been ended'
        )
      })
    })

    await plan.completed
  })

  await t.test('handles multi-entry callbacks correctly', async function (t) {
    const plan = tspl(t, { plan: 5 })
    const { agent, tracer } = t.nr

    helper.runInTransaction(agent, function () {
      const root = tracer.getSegment()

      const aSeg = agent.tracer.createSegment('A')
      tracer.setSegment(aSeg)

      const resA = new TestResource(1)

      const bSeg = agent.tracer.createSegment('B')
      tracer.setSegment(bSeg)
      const resB = new TestResource(2)

      tracer.setSegment(root)

      resA.doStuff(() => {
        plan.equal(
          tracer.getSegment().name,
          aSeg.name,
          'runInAsyncScope should restore the segment active when a resource was made'
        )

        resB.doStuff(() => {
          plan.equal(
            tracer.getSegment().name,
            bSeg.name,
            'runInAsyncScope should restore the segment active when a resource was made'
          )
        })
        plan.equal(
          tracer.getSegment().name,
          aSeg.name,
          'runInAsyncScope should restore the segment active when a callback was called'
        )
      })
      plan.equal(
        tracer.getSegment().name,
        root.name,
        'root should be restored after we are finished'
      )
      resA.doStuff(() => {
        plan.equal(
          tracer.getSegment().name,
          aSeg.name,
          'runInAsyncScope should restore the segment active when a resource was made'
        )
      })
    })

    await plan.completed
  })

  await t.test('maintains transaction context over setImmediate in-context', async (t) => {
    const plan = tspl(t, { plan: 3 })
    const { agent } = t.nr

    helper.runInTransaction(agent, function (txn) {
      plan.ok(txn, 'transaction should not be null')

      const segment = txn.trace.root
      agent.tracer.bindFunction(function one() {
        return new Promise(executor).then(() => {
          const tx = agent.getTransaction()
          plan.equal(tx ? tx.id : null, txn.id)
        })
      }, segment)()

      const wrapperTwo = agent.tracer.bindFunction(function () {
        return two()
      }, segment)
      const wrapperThree = agent.tracer.bindFunction(function () {
        return three()
      }, segment)

      function executor(resolve) {
        setImmediate(() => {
          next().then(() => {
            const tx = agent.getTransaction()
            plan.equal(tx ? tx.id : null, txn.id)
            resolve()
          })
        })
      }

      function next() {
        return Promise.resolve(wrapperTwo())
      }

      function two() {
        return nextTwo()
      }

      function nextTwo() {
        return Promise.resolve(wrapperThree())
      }

      function three() {}
    })

    await plan.completed
  })

  await t.test('maintains transaction context over process.nextTick in-context', async (t) => {
    const plan = tspl(t, { plan: 3 })
    const { agent } = t.nr

    helper.runInTransaction(agent, function (txn) {
      plan.ok(txn, 'transaction should not be null')

      const segment = txn.trace.root
      agent.tracer.bindFunction(function one() {
        return new Promise(executor).then(() => {
          const tx = agent.getTransaction()
          plan.equal(tx ? tx.id : null, txn.id)
        })
      }, segment)()

      const wrapperTwo = agent.tracer.bindFunction(function () {
        return two()
      }, segment)
      const wrapperThree = agent.tracer.bindFunction(function () {
        return three()
      }, segment)

      function executor(resolve) {
        process.nextTick(() => {
          next().then(() => {
            const tx = agent.getTransaction()
            plan.equal(tx ? tx.id : null, txn.id)
            resolve()
          })
        })
      }

      function next() {
        return Promise.resolve(wrapperTwo())
      }

      function two() {
        return nextTwo()
      }

      function nextTwo() {
        return Promise.resolve(wrapperThree())
      }

      function three() {}
    })

    await plan.completed
  })

  await t.test('maintains transaction context over setTimeout in-context', async (t) => {
    const plan = tspl(t, { plan: 3 })
    const { agent } = t.nr

    helper.runInTransaction(agent, function (txn) {
      plan.ok(txn, 'transaction should not be null')

      const segment = txn.trace.root
      agent.tracer.bindFunction(function one() {
        return new Promise(executor).then(() => {
          const tx = agent.getTransaction()
          plan.equal(tx ? tx.id : null, txn.id)
        })
      }, segment)()

      const wrapperTwo = agent.tracer.bindFunction(function () {
        return two()
      }, segment)
      const wrapperThree = agent.tracer.bindFunction(function () {
        return three()
      }, segment)

      function executor(resolve) {
        setTimeout(() => {
          next().then(() => {
            const tx = agent.getTransaction()
            plan.equal(tx ? tx.id : null, txn.id)
            resolve()
          })
        }, 1)
      }

      function next() {
        return Promise.resolve(wrapperTwo())
      }

      function two() {
        return nextTwo()
      }

      function nextTwo() {
        return Promise.resolve(wrapperThree())
      }

      function three() {}
    })

    await plan.completed
  })

  await t.test('maintains transaction context over setInterval in-context', async (t) => {
    const plan = tspl(t, { plan: 3 })
    const { agent } = t.nr

    helper.runInTransaction(agent, function (txn) {
      plan.ok(txn, 'transaction should not be null')

      const segment = txn.trace.root
      agent.tracer.bindFunction(function one() {
        return new Promise(executor).then(() => {
          const tx = agent.getTransaction()
          plan.equal(tx ? tx.id : null, txn.id)
        })
      }, segment)()

      const wrapperTwo = agent.tracer.bindFunction(function () {
        return two()
      }, segment)
      const wrapperThree = agent.tracer.bindFunction(function () {
        return three()
      }, segment)

      function executor(resolve) {
        const ref = setInterval(() => {
          clearInterval(ref)

          next().then(() => {
            const tx = agent.getTransaction()
            plan.equal(tx ? tx.id : null, txn.id)
            resolve()
          })
        }, 1)
      }

      function next() {
        return Promise.resolve(wrapperTwo())
      }

      function two() {
        return nextTwo()
      }

      function nextTwo() {
        return Promise.resolve(wrapperThree())
      }

      function three() {}
    })

    await plan.completed
  })

  // Negative assertion case mirroring test for async-hooks.
  // This is a new limitation due to AsyncLocalStorage propagation only on init.
  // The timer-hop without context prior to .then() continuation causes the state loss.
  await t.test('DOES NOT maintain transaction context over contextless timer', async (t) => {
    const plan = tspl(t, { plan: 3 })
    const { agent } = t.nr
    const tasks = []
    const intervalId = setInterval(() => {
      while (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    t.after(() => {
      clearInterval(intervalId)
    })

    helper.runInTransaction(agent, function (txn) {
      plan.ok(txn, 'transaction should not be null')

      const segment = txn.trace.root
      agent.tracer.bindFunction(one, segment)()

      const wrapperTwo = agent.tracer.bindFunction(function () {
        return two()
      }, segment)
      const wrapperThree = agent.tracer.bindFunction(function () {
        return three()
      }, segment)

      function one() {
        return new Promise(executor).then(() => {
          const tx = agent.getTransaction()
          plan.equal(tx ? tx.id : null, txn.id)
        })
      }

      function executor(resolve) {
        tasks.push(() => {
          next().then(() => {
            const tx = agent.getTransaction()
            plan.ok(
              !tx,
              'If fails, we have fixed a limitation and should check equal transaction IDs'
            )
            resolve()
          })
        })
      }

      function next() {
        return Promise.resolve(wrapperTwo())
      }

      function two() {
        return nextTwo()
      }

      function nextTwo() {
        return Promise.resolve(wrapperThree())
      }

      function three() {}
    })

    await plan.completed
  })

  // Negative assertion case mirroring test for async-hooks.
  // This is a new limitation due to AsyncLocalStorage propagation only on init.
  // The timer-hop without context prior to .then() continuation causes the state loss.
  await t.test('parent promises DO NOT persist perspective to problematic progeny', async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { agent } = t.nr
    const tasks = []
    const intervalId = setInterval(() => {
      while (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    t.after(() => {
      clearInterval(intervalId)
    })

    helper.runInTransaction(agent, function (txn) {
      plan.ok(txn, 'transaction should not be null')

      const p = Promise.resolve()

      tasks.push(() => {
        p.then(() => {
          const tx = agent.getTransaction()

          plan.ok(
            !tx,
            'If fails, we have fixed a limitation and should check equal transaction IDs'
          )
        })
      })
    })

    await plan.completed
  })

  // Negative assertion case mirroring test for async-hooks.
  // This is a new limitation due to AsyncLocalStorage propagation only on init.
  // The timer-hop without context prior to .then() continuation causes the state loss.
  await t.test('unresolved parent promises DO NOT persist to problematic progeny', async (t) => {
    const plan = tspl(t, { plan: 2 })
    const { agent } = t.nr
    const tasks = []
    const intervalId = setInterval(() => {
      while (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    t.after(() => {
      clearInterval(intervalId)
    })

    helper.runInTransaction(agent, function (txn) {
      plan.ok(txn, 'transaction should not be null')

      let parentResolve = null
      const p = new Promise((resolve) => {
        parentResolve = resolve
      })

      tasks.push(() => {
        p.then(() => {
          const tx = agent.getTransaction()
          plan.ok(
            !tx,
            'If fails, we have fixed a limitation and should check equal transaction IDs'
          )
        })

        // resolve parent after continuation scheduled
        parentResolve()
      })
    })

    await plan.completed
  })

  await t.test(
    'promise hooks are only called once during the lifetime of a promise',
    async function (t) {
      const plan = tspl(t, { plan: 3 })
      const testMetrics = createHook()
      await new Promise(function (res) {
        setTimeout(res, 10)
      })
      setImmediate(checkCallMetrics, plan, testMetrics)
      await plan.completed
    }
  )
})
