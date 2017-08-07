'use strict'
var test = require('tap').test
var helper = require('../../lib/agent_helper')
var asyncHooks = require('async_hooks')

function testSegments(t, segmentMap) {
  global.gc()
  // Give the gc some time to work.
  setImmediate(function() {
    t.notOk(Object.keys(segmentMap).length, 'segments should be cleared after gc')
    t.end()
  })
}

test('await', function(t) {
  var agent = setupAgent(t)
  helper.runInTransaction(agent, async function(txn) {
    var transaction = agent.getTransaction()
    t.equal(
      transaction && transaction.id,
      txn.id,
      'should start in a transaction'
    )

    await Promise.resolve("i'll be back")

    transaction = agent.getTransaction()
    t.equal(
      transaction && transaction.id,
      txn.id,
      'should resume in the same transaction after await'
    )

    var segmentMap = require('../../../lib/instrumentation/core/async_hooks')._segmentMap
    txn.end(function afterTransactionEnd() {
      // Segments won't be cleared till a gc cycle clears the promises
      // they are related with.
      t.ok(Object.keys(segmentMap).length, 'segments should still be in the map')
      if (global.gc) {
        // Unroll all the stack frames to let go of the refs to the
        // promises we want to gc, then call the segment tester.
        return setImmediate(testSegments, t, segmentMap)
      }
      t.end()
    })
  })
})

test("the agent's async hook", function (t) {
  t.autoend()
  t.test('does not crash on multiple resolve calls', function(t) {
    var agent = setupAgent(t)
    helper.runInTransaction(agent, function(txn) {
      var called = false
      t.doesNotThrow(function () {
        new Promise(function(res, rej) {
          res()
          res()
        }).then(function() {
          if (!called) {
            called = true
          } else {
            throw new Error('then called twice')
          }
        })
      })
      t.end()
    })
  })
})

function checkCallMetrics(t, testMetrics) {
  t.equal(testMetrics.initCalled, 2, 'two promises were created')
  t.equal(testMetrics.beforeCalled, 1, 'before hook called for all async promises')
  t.equal(
    testMetrics.beforeCalled,
    testMetrics.afterCalled,
    'before should be called as many times as after'
  )

  if (global.gc) {
    global.gc()
    return setTimeout(function() {
      t.equal(
        testMetrics.initCalled,
        testMetrics.destroyCalled,
        'all promises created were destroyed'
      )
      t.end()
    }, 10)
  }
  t.end()
}

test('promise hooks', function(t) {
  t.autoend()
  var testMetrics = {
    initCalled: 0,
    beforeCalled: 0,
    afterCalled: 0,
    destroyCalled: 0
  }

  var promiseIds = {}
  var hook = asyncHooks.createHook({
    init: function initHook(id, type, triggerAsyncId) {
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

  t.test('are only called once during the lifetime of a promise', function(t) {
    new Promise(function(res, rej) {
      setTimeout(res, 10)
    }).then(function() {
      setImmediate(checkCallMetrics, t, testMetrics)
    })
  })
})

function setupAgent(t) {
  var agent = helper.instrumentMockedAgent({
    await_support: true
  })
  t.tearDown(function() {
    helper.unloadAgent(agent)
  })

  return agent
}
