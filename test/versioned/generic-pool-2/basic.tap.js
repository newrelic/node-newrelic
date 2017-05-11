'use strict'

var a = require('async')
var helper = require('../../lib/agent_helper')
var tap = require('tap')


tap.test('generic-pool', function(t) {
  t.autoend()

  var agent = null
  var pool = null
  var PoolClass = require('generic-pool').Pool

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent()
    pool = require('generic-pool')
    done()
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    pool = null
    done()
  })

  var tasks = []
  var decontextInterval = setInterval(function() {
    if (tasks.length > 0) {
      tasks.pop()()
    }
  }, 10)

  t.tearDown(function() {
    clearInterval(decontextInterval)
  })

  function addTask(cb, args) {
    tasks.push(function() {
      return cb.apply(null, args || [])
    })
  }

  function id(tx) {
    return tx && tx.id
  }

  t.test('instantiation', function(t) {
    t.plan(4)

    t.doesNotThrow(function() {
      var p = pool.Pool({ // eslint-disable-line new-cap
        create: function(cb) { addTask(cb, [null, {}]) },
        destroy: function(o, cb) { addTask(cb) }
      })
      t.type(p, PoolClass, 'should create a Pool')
    }, 'should be able to instantiate without new')

    t.doesNotThrow(function() {
      var p = new pool.Pool({
        create: function(cb) { addTask(cb, [null, {}]) },
        destroy: function(o, cb) { addTask(cb) }
      })
      t.type(p, PoolClass, 'should create a Pool')
    }, 'should be able to instantiate with new')
  })

  t.test('context maintenance', function(t) {
    var p = new pool.Pool({
      max: 2,
      min: 0,
      create: function(cb) { addTask(cb, [null, {}]) },
      destroy: function(o, cb) { addTask(cb) }
    })

    a.times(6, run, function(err) {
      t.error(err, 'should not error when acquiring')
      drain()
    })

    function run(n, cb) {
      helper.runInTransaction(agent, function(tx) {
        p.acquire(function(err, c) {
          if (err) {
            return cb(err)
          }

          t.equal(id(agent.getTransaction()), id(tx), n + ': should maintain tx state')
          addTask(function() {
            p.release(c)
            cb()
          })
        })
      })
    }

    function drain() {
      run('drain', function(err) {
        t.error(err, 'should not error when acquired before draining')
      })

      helper.runInTransaction(agent, function(tx) {
        p.drain(function() {
          t.equal(id(agent.getTransaction()), id(tx), 'should have context through drain')

          p.destroyAllNow(function() {
            t.equal(
              id(agent.getTransaction()), id(tx),
              'should have context through destroy'
            )
            t.end()
          })
        })
      })
    }
  })
})
