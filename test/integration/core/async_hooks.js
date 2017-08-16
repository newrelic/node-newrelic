'use strict'
var test = require('tap').test
var helper = require('../../lib/agent_helper')
var asyncHooks = require('async_hooks')

function testSegments(t, segmentMap) {
  global.gc()
  // Give the gc some time to work.
  setTimeout(function() {
    t.notOk(Object.keys(segmentMap).length, 'segments should be cleared after gc')
    t.end()
  }, 10)
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

test("the agent's async hook", function(t) {
  class TestResource extends asyncHooks.AsyncResource {
    constructor(id) {
      super('PROMISE', id)
    }

    doStuff(callback) {
      process.nextTick(() => {
        this.emitBefore()
        callback()
        this.emitAfter()
      })
    }
  }

  t.autoend()
  t.test('does not crash on multiple resolve calls', function(t) {
    var agent = setupAgent(t)
    helper.runInTransaction(agent, function(txn) {
      var called = false
      t.doesNotThrow(function () {
        new Promise(function(res, rej) {
          res()
          res()
        }).then(t.end)
      })
    })
  })

  t.test('does not restore a segment for a resource created outside a transaction', function(t) {
    var agent = setupAgent(t)
    var res = new TestResource(1)
    helper.runInTransaction(agent, function(txn) {
      var root = agent.tracer.segment
      var segmentMap = require('../../../lib/instrumentation/core/async_hooks')._segmentMap
      t.equal(Object.keys(segmentMap).length, 0, 'no segments should be tracked')
      res.doStuff(function() {
        t.ok(agent.tracer.segment, 'should be in a transaction')
        t.equal(
          agent.tracer.segment.name,
          root.name,
          'the agent loses transaction state for resources created outside of a transaction'
        )
        t.end()
      })
    })
  })

  t.test('restores context in inactive transactions', function(t) {
    var agent = setupAgent(t)
    helper.runInTransaction(agent, function(txn) {
      var res = new TestResource(1)
      var root = agent.tracer.segment
      txn.end()
      res.doStuff(function() {
        t.equal(
          agent.tracer.segment,
          root,
          'the hooks restore a segment when its transaction has been ended'
        )
        t.end()
      })
    })
  })

  t.test('handles multientry callbacks correctly', function(t) {
    var agent = setupAgent(t)
    var segmentMap = require('../../../lib/instrumentation/core/async_hooks')._segmentMap
    helper.runInTransaction(agent, function(txn) {
      var root = agent.tracer.segment

      var aSeg = agent.tracer.createSegment('A')
      agent.tracer.segment = aSeg
      var resA = new TestResource(1)

      var bSeg = agent.tracer.createSegment('B')
      agent.tracer.segment = bSeg
      var resB = new TestResource(2)

      agent.tracer.segment = root

      t.equal(
        Object.keys(segmentMap).length,
        2,
        'all resources should create an entry on init'
      )

      resA.doStuff(() => {
        t.equal(
          agent.tracer.segment.name,
          aSeg.name,
          'calling emitBefore should restore the segment active when a resource was made'
        )

        resB.doStuff(() => {
          t.equal(
            agent.tracer.segment.name,
            bSeg.name,
            'calling emitBefore should restore the segment active when a resource was made'
          )

          t.end()
        })
        t.equal(
          agent.tracer.segment.name,
          aSeg.name,
          'calling emitAfter should restore the segment active when a callback was called'
        )
      })
      t.equal(
        agent.tracer.segment.name,
        root.name,
        'root should be restored after we are finished'
      )
      resA.doStuff(() => {
        t.equal(
          agent.tracer.segment.name,
          aSeg.name,
          'calling emitBefore should restore the segment active when a resource was made'
        )
      })
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
