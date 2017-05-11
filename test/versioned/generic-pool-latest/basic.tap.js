'use strict'

var a = require('async')
var helper = require('../../lib/agent_helper')
var semver = require('semver')
var tap = require('tap')


tap.test('generic-pool', function(t) {
  t.autoend()

  if (semver.lt(process.version, '4.0.0')) {
    return
  }

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
    t.plan(2)

    // As of generic-pool 3, it is not possible to instantiate Pool without `new`.

    t.doesNotThrow(function() {
      var p = pool.createPool({
        create: function() { return new Promise(function(res) { addTask(res, {}) }) },
        destroy: function() { return new Promise(function(res) { addTask(res) }) }
      })
      t.type(p, PoolClass, 'should create a Pool')
    }, 'should be able to instantiate with createPool')
  })

  t.test('context maintenance', function(t) {
    var p = pool.createPool({
      create: function() { return new Promise(function(res) { addTask(res, {}) }) },
      destroy: function() { return new Promise(function(res) { addTask(res) }) }
    }, {
      max: 2,
      min: 0
    })

    a.times(6, run, function(err) {
      t.error(err, 'should not error when acquiring')
      drain()
    })

    function run(n, cb) {
      helper.runInTransaction(agent, function(tx) {
        p.acquire().then(function(c) {
          t.equal(id(agent.getTransaction()), id(tx), n + ': should maintain tx state')
          addTask(function() {
            p.release(c)
            cb()
          })
        }, cb)
      })
    }

    function drain() {
      run('drain', function(err) {
        t.error(err, 'should not error when acquired before draining')
      })

      helper.runInTransaction(agent, function(tx) {
        p.drain().then(function() {
          t.equal(id(agent.getTransaction()), id(tx), 'should have context through drain')

          return p.clear().then(function() {
            t.equal(
              id(agent.getTransaction()), id(tx),
              'should have context through destroy'
            )
          })
        }).then(function() {
          t.end()
        }, function(err) {
          t.error(err)
          t.end()
        })
      })
    }
  })
})
