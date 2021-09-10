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
      tasks.pop()()
    }
  }, 10)

  t.teardown(function () {
    clearInterval(decontextInterval)
  })

  function addTask(cb, args) {
    tasks.push(function () {
      return cb.apply(null, args || [])
    })
  }

  function id(tx) {
    return tx && tx.id
  }

  t.test('instantiation', function (t) {
    t.plan(2)

    // As of generic-pool 3, it is not possible to instantiate Pool without `new`.

    t.doesNotThrow(function () {
      const p = pool.createPool({
        create: function () {
          return new Promise(function (res) {
            addTask(res, {})
          })
        },
        destroy: function () {
          return new Promise(function (res) {
            addTask(res)
          })
        }
      })
      t.type(p, PoolClass, 'should create a Pool')
    }, 'should be able to instantiate with createPool')
  })

  t.test('context maintenance', function (t) {
    const p = pool.createPool(
      {
        create: function () {
          return new Promise(function (res) {
            addTask(res, {})
          })
        },
        destroy: function () {
          return new Promise(function (res) {
            addTask(res)
          })
        }
      },
      {
        max: 2,
        min: 0
      }
    )

    a.times(6, run, function (err) {
      t.error(err, 'should not error when acquiring')
      drain()
    })

    function run(n, cb) {
      helper.runInTransaction(agent, function (tx) {
        p.acquire().then(function (c) {
          t.equal(id(agent.getTransaction()), id(tx), n + ': should maintain tx state')
          addTask(function () {
            p.release(c)
            cb()
          })
        }, cb)
      })
    }

    function drain() {
      run('drain', function (err) {
        t.error(err, 'should not error when acquired before draining')
      })

      helper.runInTransaction(agent, function (tx) {
        p.drain()
          .then(function () {
            t.equal(id(agent.getTransaction()), id(tx), 'should have context through drain')

            return p.clear().then(function () {
              t.equal(id(agent.getTransaction()), id(tx), 'should have context through destroy')
            })
          })
          .then(
            function () {
              t.end()
            },
            function (err) {
              t.error(err)
              t.end()
            }
          )
      })
    }
  })
})
