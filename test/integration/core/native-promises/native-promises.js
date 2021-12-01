/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')
const semver = require('semver')

const helper = require('../../../lib/agent_helper')
const asyncHooks = require('async_hooks')

const skipAsyncHooks = process.env.NEW_RELIC_FEATURE_FLAG_ASYNC_LOCAL_CONTEXT
test('Async-hooks + timer instrumentation based tracking', { skip: skipAsyncHooks }, (t) => {
  t.autoend()

  const config = {
    feature_flag: {
      await_support: true,
      async_local_context: false
    }
  }

  createPromiseTests(t, config)

  t.test('parent promises persist perspective to problematic progeny', (t) => {
    const { agent } = setupAgent(t, config)
    const tasks = []
    const intervalId = setInterval(() => {
      while (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    t.teardown(() => {
      clearInterval(intervalId)
    })

    helper.runInTransaction(agent, function (txn) {
      t.ok(txn, 'transaction should not be null')

      const p = Promise.resolve()

      tasks.push(() => {
        p.then(() => {
          const tx = agent.getTransaction()
          t.equal(tx ? tx.id : null, txn.id)
          t.end()
        })
      })
    })
  })

  t.test('maintains transaction context over contextless timer', (t) => {
    const { agent } = setupAgent(t, config)
    const tasks = []
    const intervalId = setInterval(() => {
      while (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    t.teardown(() => {
      clearInterval(intervalId)
    })

    helper.runInTransaction(agent, function (txn) {
      t.ok(txn, 'transaction should not be null')

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
          t.equal(tx ? tx.id : null, txn.id)
          t.end()
        })
      }

      function executor(resolve) {
        tasks.push(() => {
          next().then(() => {
            const tx = agent.getTransaction()
            t.equal(tx ? tx.id : null, txn.id)
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
  })

  t.test('unresolved parent promises persist to problematic progeny', (t) => {
    const { agent } = setupAgent(t, config)
    const tasks = []
    const intervalId = setInterval(() => {
      while (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    t.teardown(() => {
      clearInterval(intervalId)
    })

    helper.runInTransaction(agent, function (txn) {
      t.ok(txn, 'transaction should not be null')

      let parentResolve = null
      const p = new Promise((resolve) => {
        parentResolve = resolve
      })

      tasks.push(() => {
        p.then(() => {
          const tx = agent.getTransaction()
          t.equal(tx ? tx.id : null, txn.id)

          t.end()
        })

        // resolve parent after continuation scheduled
        parentResolve()
      })
    })
  })

  t.test('loses transaction context when no promise returned', function (t) {
    const { agent } = setupAgent(t, config)
    const tasks = []
    const intervalId = setInterval(() => {
      while (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    t.teardown(() => {
      clearInterval(intervalId)
    })

    helper.runInTransaction(agent, function (txn) {
      t.ok(txn, 'transaction should not be null')
      const segment = txn.trace.root
      agent.tracer.bindFunction(one, segment)()

      const wrapperTwo = agent.tracer.bindFunction(function () {
        return two()
      }, segment)

      function one() {
        return new Promise(executor).then(() => {
          const tx = agent.getTransaction()
          t.equal(tx ? tx.id : null, txn.id)
          t.end()
        })
      }

      function executor(resolve) {
        tasks.push(() => {
          next().then(() => {
            const tx = agent.getTransaction()
            // We know tx will be null here because no promise was returned
            // If this test fails, that's actually a good thing,
            // so throw a party/update Koa.
            t.equal(tx, null)
            resolve()
          })
        })
      }

      function next() {
        return Promise.resolve(wrapperTwo())
      }

      function two() {
        // No promise is returned to reinstate transaction context
      }
    })
  })
})

const skipAsyncLocal = semver.satisfies(process.version, '<16.4.0')
test('AsyncLocalStorage based tracking', { skip: skipAsyncLocal }, (t) => {
  t.autoend()

  const config = {
    feature_flag: {
      async_local_context: true
    }
  }

  createPromiseTests(t, config)

  // Negative assertion case mirroring test for async-hooks.
  // This is a new limitation due to AsyncLocalStorage propagation only on init.
  // The timer-hop without context prior to .then() continuation causes the state loss.
  t.test('DOES NOT maintain transaction context over contextless timer', (t) => {
    const { agent } = setupAgent(t, config)
    const tasks = []
    const intervalId = setInterval(() => {
      while (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    t.teardown(() => {
      clearInterval(intervalId)
    })

    helper.runInTransaction(agent, function (txn) {
      t.ok(txn, 'transaction should not be null')

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
          t.equal(tx ? tx.id : null, txn.id)
          t.end()
        })
      }

      function executor(resolve) {
        tasks.push(() => {
          next().then(() => {
            const tx = agent.getTransaction()
            t.notOk(
              tx,
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
  })

  // Negative assertion case mirroring test for async-hooks.
  // This is a new limitation due to AsyncLocalStorage propagation only on init.
  // The timer-hop without context prior to .then() continuation causes the state loss.
  t.test('parent promises DO NOT persist perspective to problematic progeny', (t) => {
    const { agent } = setupAgent(t, config)
    const tasks = []
    const intervalId = setInterval(() => {
      while (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    t.teardown(() => {
      clearInterval(intervalId)
    })

    helper.runInTransaction(agent, function (txn) {
      t.ok(txn, 'transaction should not be null')

      const p = Promise.resolve()

      tasks.push(() => {
        p.then(() => {
          const tx = agent.getTransaction()

          t.notOk(tx, 'If fails, we have fixed a limitation and should check equal transaction IDs')
          t.end()
        })
      })
    })
  })

  // Negative assertion case mirroring test for async-hooks.
  // This is a new limitation due to AsyncLocalStorage propagation only on init.
  // The timer-hop without context prior to .then() continuation causes the state loss.
  t.test('unresolved parent promises DO NOT persist to problematic progeny', (t) => {
    const { agent } = setupAgent(t, config)
    const tasks = []
    const intervalId = setInterval(() => {
      while (tasks.length) {
        tasks.pop()()
      }
    }, 10)

    t.teardown(() => {
      clearInterval(intervalId)
    })

    helper.runInTransaction(agent, function (txn) {
      t.ok(txn, 'transaction should not be null')

      let parentResolve = null
      const p = new Promise((resolve) => {
        parentResolve = resolve
      })

      tasks.push(() => {
        p.then(() => {
          const tx = agent.getTransaction()
          t.notOk(tx, 'If fails, we have fixed a limitation and should check equal transaction IDs')

          t.end()
        })

        // resolve parent after continuation scheduled
        parentResolve()
      })
    })
  })
})

function createPromiseTests(t, config) {
  t.test('maintains context across await', function (t) {
    const { agent } = setupAgent(t, config)
    helper.runInTransaction(agent, async function (txn) {
      let transaction = agent.getTransaction()
      t.equal(transaction && transaction.id, txn.id, 'should start in a transaction')

      await Promise.resolve("i'll be back")

      transaction = agent.getTransaction()
      t.equal(
        transaction && transaction.id,
        txn.id,
        'should resume in the same transaction after await'
      )

      txn.end()
      t.end()
    })
  })

  t.test('maintains context across multiple awaits', async (t) => {
    const { agent } = setupAgent(t, config)
    await helper.runInTransaction(agent, async function (createdTransaction) {
      let transaction = agent.getTransaction()
      t.equal(transaction && transaction.id, createdTransaction.id, 'should start in a transaction')

      await firstFunction()
      transaction = agent.getTransaction()
      t.equal(transaction && transaction.id, createdTransaction.id)

      await secondFunction()
      transaction = agent.getTransaction()
      t.equal(transaction && transaction.id, createdTransaction.id)

      createdTransaction.end()

      async function firstFunction() {
        await childFunction()

        transaction = agent.getTransaction()
        t.equal(transaction && transaction.id, createdTransaction.id)
      }

      async function childFunction() {
        await new Promise((resolve) => {
          transaction = agent.getTransaction()
          t.equal(transaction && transaction.id, createdTransaction.id)

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

  t.test('does not crash on multiple resolve calls', function (t) {
    const { agent } = setupAgent(t, config)
    helper.runInTransaction(agent, function () {
      t.doesNotThrow(function () {
        new Promise(function (res) {
          res()
          res()
        }).then(t.end)
      })
    })
  })

  t.test('restores context in inactive transactions', function (t) {
    const { agent, contextManager } = setupAgent(t, config)

    helper.runInTransaction(agent, function (txn) {
      const res = new TestResource(1)
      const root = contextManager.getContext()
      txn.end()
      res.doStuff(function () {
        t.equal(
          contextManager.getContext(),
          root,
          'should restore a segment when its transaction has been ended'
        )
        t.end()
      })
    })
  })

  t.test('handles multi-entry callbacks correctly', function (t) {
    const { agent, contextManager } = setupAgent(t, config)

    helper.runInTransaction(agent, function () {
      const root = contextManager.getContext()

      const aSeg = agent.tracer.createSegment('A')
      contextManager.setContext(aSeg)

      const resA = new TestResource(1)

      const bSeg = agent.tracer.createSegment('B')
      contextManager.setContext(bSeg)
      const resB = new TestResource(2)

      contextManager.setContext(root)

      resA.doStuff(() => {
        t.equal(
          contextManager.getContext().name,
          aSeg.name,
          'runInAsyncScope should restore the segment active when a resource was made'
        )

        resB.doStuff(() => {
          t.equal(
            contextManager.getContext().name,
            bSeg.name,
            'runInAsyncScope should restore the segment active when a resource was made'
          )

          t.end()
        })
        t.equal(
          contextManager.getContext().name,
          aSeg.name,
          'runInAsyncScope should restore the segment active when a callback was called'
        )
      })
      t.equal(
        contextManager.getContext().name,
        root.name,
        'root should be restored after we are finished'
      )
      resA.doStuff(() => {
        t.equal(
          contextManager.getContext().name,
          aSeg.name,
          'runInAsyncScope should restore the segment active when a resource was made'
        )
      })
    })
  })

  t.test('maintains transaction context over setImmediate in-context', (t) => {
    const { agent } = setupAgent(t, config)

    helper.runInTransaction(agent, function (txn) {
      t.ok(txn, 'transaction should not be null')

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
          t.equal(tx ? tx.id : null, txn.id)
          t.end()
        })
      }

      function executor(resolve) {
        setImmediate(() => {
          next().then(() => {
            const tx = agent.getTransaction()
            t.equal(tx ? tx.id : null, txn.id)
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
  })

  t.test('maintains transaction context over process.nextTick in-context', (t) => {
    const { agent } = setupAgent(t, config)

    helper.runInTransaction(agent, function (txn) {
      t.ok(txn, 'transaction should not be null')

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
          t.equal(tx ? tx.id : null, txn.id)
          t.end()
        })
      }

      function executor(resolve) {
        process.nextTick(() => {
          next().then(() => {
            const tx = agent.getTransaction()
            t.equal(tx ? tx.id : null, txn.id)
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
  })

  t.test('maintains transaction context over setTimeout in-context', (t) => {
    const { agent } = setupAgent(t, config)

    helper.runInTransaction(agent, function (txn) {
      t.ok(txn, 'transaction should not be null')

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
          t.equal(tx ? tx.id : null, txn.id)
          t.end()
        })
      }

      function executor(resolve) {
        setTimeout(() => {
          next().then(() => {
            const tx = agent.getTransaction()
            t.equal(tx ? tx.id : null, txn.id)
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
  })

  t.test('maintains transaction context over setInterval in-context', (t) => {
    const { agent } = setupAgent(t, config)

    helper.runInTransaction(agent, function (txn) {
      t.ok(txn, 'transaction should not be null')

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
          t.equal(tx ? tx.id : null, txn.id)
          t.end()
        })
      }

      function executor(resolve) {
        const ref = setInterval(() => {
          clearInterval(ref)

          next().then(() => {
            const tx = agent.getTransaction()
            t.equal(tx ? tx.id : null, txn.id)
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
  })
}

function checkCallMetrics(t, testMetrics) {
  // Tap also creates promises, so these counts don't quite match the tests.
  const TAP_COUNT = 1

  t.equal(testMetrics.initCalled - TAP_COUNT, 2, 'two promises were created')
  t.equal(testMetrics.beforeCalled, 1, 'before hook called for all async promises')
  t.equal(
    testMetrics.beforeCalled,
    testMetrics.afterCalled,
    'before should be called as many times as after'
  )

  if (global.gc) {
    global.gc()
    return setTimeout(function () {
      t.equal(
        testMetrics.initCalled - TAP_COUNT,
        testMetrics.destroyCalled,
        'all promises created were destroyed'
      )
      t.end()
    }, 10)
  }
  t.end()
}

test('promise hooks', function (t) {
  t.autoend()
  const testMetrics = {
    initCalled: 0,
    beforeCalled: 0,
    afterCalled: 0,
    destroyCalled: 0
  }

  const promiseIds = {}
  const hook = asyncHooks.createHook({
    init: function initHook(id, type) {
      if (type === 'PROMISE') {
        promiseIds[id] = true
        testMetrics.initCalled++
      }
    },
    before: function beforeHook(id) {
      if (promiseIds[id]) {
        testMetrics.beforeCalled++
      }
    },
    after: function afterHook(id) {
      if (promiseIds[id]) {
        testMetrics.afterCalled++
      }
    },
    destroy: function destHook(id) {
      if (promiseIds[id]) {
        testMetrics.destroyCalled++
      }
    }
  })
  hook.enable()

  t.test('are only called once during the lifetime of a promise', function (t) {
    new Promise(function (res) {
      setTimeout(res, 10)
    }).then(function () {
      setImmediate(checkCallMetrics, t, testMetrics)
    })
  })
})

function setupAgent(t, config) {
  const agent = helper.instrumentMockedAgent(config)
  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  const contextManager = helper.getContextManager()

  return {
    agent,
    contextManager
  }
}

class TestResource extends asyncHooks.AsyncResource {
  constructor(id) {
    super('PROMISE', id)
  }

  doStuff(callback) {
    process.nextTick(() => {
      if (this.runInAsyncScope) {
        this.runInAsyncScope(callback)
      } else {
        this.emitBefore()
        callback()
        this.emitAfter()
      }
    })
  }
}
