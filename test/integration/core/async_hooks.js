/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('tap').test
const helper = require('../../lib/agent_helper')
const asyncHooks = require('async_hooks')

function testSegments(t, segmentMap) {
  global.gc()
  // Give the gc some time to work.
  setTimeout(function () {
    t.notOk(segmentMap.size, 'segments should be cleared after gc')
    t.end()
  }, 10)
}

test('await', function (t) {
  const { agent } = setupAgent(t)
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

    const segmentMap = require('../../../lib/instrumentation/core/async_hooks').segmentMap
    txn.end()
    // Segments won't be cleared till a gc cycle clears the promises
    // they are related with.
    t.ok(segmentMap.size, 'segments should still be in the map')
    if (global.gc) {
      // Unroll all the stack frames to let go of the refs to the
      // promises we want to gc, then call the segment tester.
      return setImmediate(testSegments, t, segmentMap)
    }
    t.end()
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
        new Promise(function (res) {
          res()
          res()
        }).then(t.end)
      })
    })
  })

  t.test('does not restore a segment for a resource created outside a transaction', function (t) {
    const { agent, contextManager } = setupAgent(t)

    const res = new TestResource(1)
    helper.runInTransaction(agent, function () {
      const root = contextManager.getContext()
      const segmentMap = require('../../../lib/instrumentation/core/async_hooks').segmentMap

      t.equal(segmentMap.size, 0, 'no segments should be tracked')
      res.doStuff(function () {
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
      const res = new TestResource(1)
      const root = contextManager.getContext()
      txn.end()
      res.doStuff(function () {
        t.equal(
          contextManager.getContext(),
          root,
          'the hooks restore a segment when its transaction has been ended'
        )
        t.end()
      })
    })
  })

  t.test('parent promises persist perspective to problematic progeny', function (t) {
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
          t.equal(tx ? tx.id : null, txn.id)
          t.end()
        })
      })
    })
  })

  t.test('maintains transaction context', function (t) {
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
    new Promise(function (res) {
      setTimeout(res, 10)
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

  return { agent, contextManager }
}
