/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const helper = require('../../lib/agent_helper')
const asyncHooks = require('async_hooks')

test('await', function (t) {
  const { agent } = setupAgent(t)

  helper.runInTransaction(agent, async function (txn) {
    let transaction = agent.getTransaction()
    t.equal(transaction && transaction.id, txn.id, 'should start in a transaction')

    const segmentMap = require('../../../lib/instrumentation/core/async_hooks').segmentMap

    const promise = new Promise((resolve) => {
      // don't immediately resolve so logic can kick in.
      setImmediate(resolve)
    })

    // There may be extra promises in play
    const promiseId = [...segmentMap.keys()].pop()

    await promise

    t.notOk(segmentMap.has(promiseId), 'should have removed segment for promise after resolve')

    transaction = agent.getTransaction()
    t.equal(
      transaction && transaction.id,
      txn.id,
      'should resume in the same transaction after await'
    )

    txn.end()

    // Let the loop iterate to clear the microtask queue
    setImmediate(() => {
      t.equal(segmentMap.size, 0, 'should clear segments after all promises resolved')
      t.end()
    })
  })
})

test("the agent's async hook", function (t) {
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

  t.autoend()
  t.test('does not crash on multiple resolve calls', function (t) {
    const { agent } = setupAgent(t)
    helper.runInTransaction(agent, function () {
      t.doesNotThrow(function () {
        new Promise(function (resolve) {
          resolve()
          resolve()
        }).then(t.end)
      })
    })
  })

  t.test('does not restore a segment for a resource created outside a transaction', function (t) {
    const { agent, contextManager } = setupAgent(t)

    const testResource = new TestResource(1)
    helper.runInTransaction(agent, function () {
      const root = contextManager.getContext()
      const segmentMap = require('../../../lib/instrumentation/core/async_hooks').segmentMap

      t.equal(segmentMap.size, 0, 'no segments should be tracked')
      testResource.doStuff(function () {
        t.ok(contextManager.getContext(), 'should be in a transaction')
        t.equal(
          contextManager.getContext().name,
          root.name,
          'loses transaction state for resources created outside of a transaction'
        )
        t.end()
      })
    })
  })

  t.test('restores context in inactive transactions', function (t) {
    const { agent, contextManager } = setupAgent(t)

    helper.runInTransaction(agent, function (txn) {
      const testResource = new TestResource(1)
      const root = contextManager.getContext()
      txn.end()
      testResource.doStuff(function () {
        t.equal(
          contextManager.getContext(),
          root,
          'the hooks restore a segment when its transaction has been ended'
        )
        t.end()
      })
    })
  })

  /**
   * Represents same test as 'parent promises persist perspective to problematic progeny'
   * from async_hooks.js.
   *
   * This specific use case is not currently supported with the implementation that clears
   * segment references on promise resolve.
   */
  t.test(
    'parent promises that are already resolved DO NOT persist to continuations ' +
      'scheduled after a timer async hop.',
    function (t) {
      const { agent } = setupAgent(t)
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
            t.not(
              tx ? tx.id : null,
              txn.id,
              'If this failed, this use case now works! Time to switch to "t.equal"'
            )
            t.end()
          })
        })
      })
    }
  )

  /**
   * Variation of 'parent promises persist perspective to problematic progeny' from async_hooks.js.
   *
   * For unresolved parent promises, persistance should stil work as expected.
   */
  t.test('unresolved parent promises persist perspective to problematic progeny', function (t) {
    const { agent } = setupAgent(t)
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

  /**
   * Represents same test as 'maintains transaction context' from async_hooks.js.
   *
   * Combination of a timer that does not propagate state and the new resolve
   * mechanism that clears (and sets hook as active) causes this to fail.
   */
  t.test('DOES NOT maintain transaction context', function (t) {
    const { agent } = setupAgent(t)
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
            t.not(
              tx ? tx.id : null,
              txn.id,
              'If this failed, this use case now works! Time to switch to "t.equal"'
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

  t.test('maintains transaction context for unresolved promises', function (t) {
    const { agent } = setupAgent(t)
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
        setImmediate(() => {
          next().then(() => {
            const tx = agent.getTransaction()
            t.equal(tx ? tx.id : null, txn.id)
            resolve()
          })
        })
      }

      function next() {
        return new Promise((resolve) => {
          const val = wrapperTwo()
          setImmediate(() => {
            resolve(val)
          })
        })
      }

      function two() {
        return nextTwo()
      }

      function nextTwo() {
        return new Promise((resolve) => {
          const val = wrapperThree()
          setImmediate(() => {
            resolve(val)
          })
        })
      }

      function three() {}
    })
  })

  t.test('stops propagation on transaction end', function (t) {
    const { agent, contextManager } = setupAgent(t)

    helper.runInTransaction(agent, function (txn) {
      t.ok(txn, 'transaction should not be null')
      const segment = txn.trace.root
      agent.tracer.bindFunction(one, segment)()

      function one() {
        return new Promise((done) => {
          const currentSegment = contextManager.getContext()
          t.ok(currentSegment, 'should have propagated a segment')
          txn.end()

          done()
        }).then(() => {
          const currentSegment = contextManager.getContext()
          t.notOk(currentSegment, 'should not have a propagated segment')
          t.end()
        })
      }
    })
  })

  t.test('loses transaction context', function (t) {
    const { agent } = setupAgent(t)
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

  t.test('handles multientry callbacks correctly', function (t) {
    const { agent, contextManager } = setupAgent(t)

    const segmentMap = require('../../../lib/instrumentation/core/async_hooks').segmentMap
    helper.runInTransaction(agent, function () {
      const root = contextManager.getContext()

      const aSeg = agent.tracer.createSegment('A')
      contextManager.setContext(aSeg)
      const resA = new TestResource(1)

      const bSeg = agent.tracer.createSegment('B')
      contextManager.setContext(bSeg)
      const resB = new TestResource(2)

      contextManager.setContext(root)

      t.equal(segmentMap.size, 2, 'all resources should create an entry on init')

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

  t.test(
    'cleans up unresolved promises on destroy',
    { skip: process.env.NEW_RELIC_FEATURE_FLAG_UNRESOLVED_PROMISE_CLEANUP === 'false' },
    (t) => {
      const { agent } = setupAgent(t)
      const segmentMap = require('../../../lib/instrumentation/core/async_hooks').segmentMap

      helper.runInTransaction(agent, () => {
        /* eslint-disable no-unused-vars */
        let promise = unresolvedPromiseFunc()

        t.equal(segmentMap.size, 1, 'segment map should have 1 element')

        promise = null

        global.gc && global.gc()

        setImmediate(() => {
          t.equal(segmentMap.size, 0, 'segment map should clean up unresolved promises on destroy')
          t.end()
        })
      })

      function unresolvedPromiseFunc() {
        return new Promise(() => {})
      }
    }
  )

  t.test(
    'does not clean up unresolved promises on destroy when `unresolved_promise_cleanup` is set to false',
    { skip: process.env.NEW_RELIC_FEATURE_FLAG_UNRESOLVED_PROMISE_CLEANUP !== 'false' },
    (t) => {
      const { agent } = setupAgent(t)
      const segmentMap = require('../../../lib/instrumentation/core/async_hooks').segmentMap

      helper.runInTransaction(agent, () => {
        /* eslint-disable no-unused-vars */
        let promise = unresolvedPromiseFunc()

        t.equal(segmentMap.size, 1, 'segment map should have 1 element')

        promise = null

        global.gc && global.gc()

        setImmediate(() => {
          t.equal(
            segmentMap.size,
            1,
            'segment map should not clean up unresolved promise on destroy'
          )
          t.end()
        })
      })

      function unresolvedPromiseFunc() {
        return new Promise(() => {})
      }
    }
  )
})

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
    new Promise(function (resolve) {
      setTimeout(resolve, 10)
    }).then(function () {
      setImmediate(checkCallMetrics, t, testMetrics)
    })
  })
})

function setupAgent(t) {
  const agent = helper.instrumentMockedAgent({
    feature_flag: { await_support: true }
  })

  const contextManager = helper.getContextManager()

  t.teardown(function () {
    helper.unloadAgent(agent)
  })

  return {
    agent,
    contextManager
  }
}
