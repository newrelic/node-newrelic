/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const a = require('async')
const helper = require('../../lib/agent_helper')
const tap = require('tap')

tap.test('generic-pool', function (t) {
  t.autoend()

  let agent = null
  let pool = null
  const PoolClass = require('generic-pool').Pool

  t.beforeEach(function () {
    agent = helper.instrumentMockedAgent()
    pool = require('generic-pool')
  })

  t.afterEach(function () {
    helper.unloadAgent(agent)
    pool = null
  })

  const tasks = []
  const decontextInterval = setInterval(function () {
    if (tasks.length > 0) {
      const fn = tasks.pop()
      fn()
    }
  }, 10)

  t.teardown(function () {
    clearInterval(decontextInterval)
  })

  function addTask(cb, args) {
    // in versions 2.5.2 and below
    // destroy tasks do not pass a callback
    // so let's not add a task if cb is undefined
    if (!cb) {
      return
    }
    tasks.push(function () {
      return cb.apply(null, args || [])
    })
  }

  function id(tx) {
    return tx && tx.id
  }

  t.test('instantiation', function (t) {
    t.plan(4)

    t.doesNotThrow(function () {
      // eslint-disable-next-line new-cap
      const p = pool.Pool({
        create: function (cb) {
          addTask(cb, [null, {}])
        },
        destroy: function (o, cb) {
          addTask(cb)
        }
      })
      t.type(p, PoolClass, 'should create a Pool')
    }, 'should be able to instantiate without new')

    t.doesNotThrow(function () {
      const p = new pool.Pool({
        create: function (cb) {
          addTask(cb, [null, {}])
        },
        destroy: function (o, cb) {
          addTask(cb)
        }
      })
      t.type(p, PoolClass, 'should create a Pool')
    }, 'should be able to instantiate with new')
  })

  t.test('context maintenance', function (t) {
    const p = new pool.Pool({
      max: 2,
      min: 0,
      create: function (cb) {
        addTask(cb, [null, {}])
      },
      destroy: function (o, cb) {
        addTask(cb)
      }
    })

    a.times(6, run, function (err) {
      t.error(err, 'should not error when acquiring')
      drain()
    })

    function run(n, cb) {
      helper.runInTransaction(agent, function (tx) {
        p.acquire(function (err, c) {
          if (err) {
            return cb(err)
          }

          t.equal(id(agent.getTransaction()), id(tx), n + ': should maintain tx state')
          addTask(function () {
            p.release(c)
            cb()
          })
        })
      })
    }

    function drain() {
      run('drain', function (err) {
        t.error(err, 'should not error when acquired before draining')
      })

      helper.runInTransaction(agent, function (tx) {
        p.drain(function () {
          t.equal(id(agent.getTransaction()), id(tx), 'should have context through drain')

          p.destroyAllNow(function () {
            t.equal(id(agent.getTransaction()), id(tx), 'should have context through destroy')
            t.end()
          })
        })
      })
    }
  })
})
