/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const tspl = require('@matteo.collina/tspl')
const { assertPackageMetrics } = require('../../lib/custom-assertions')

const { removeModules } = require('../../lib/cache-buster')
const helper = require('../../lib/agent_helper')

let PoolClass
test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  ctx.nr.pool = require('generic-pool')
  PoolClass = ctx.nr.pool.Pool

  // Uinstrumented task manager:
  ctx.nr.tasks = []
  ctx.nr.tasksInterval = setInterval(() => {
    if (ctx.nr.tasks.length > 0) {
      ctx.nr.tasks.pop()()
    }
  }, 10)
  ctx.nr.addTask = (cb, args = []) => {
    ctx.nr.tasks.push(() => cb.apply(null, args))
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  removeModules(['generic-pool'])
  clearInterval(ctx.nr.tasksInterval)
})

function id(tx) {
  return tx?.id
}

test('should log tracking metrics', function(t) {
  const { agent } = t.nr
  const { version } = require('generic-pool/package.json')
  assertPackageMetrics({ agent, pkg: 'generic-pool', version })
})

test('instantiation', (t) => {
  const plan = tspl(t, { plan: 2 })
  const { addTask, pool } = t.nr

  // As of generic-pool 3, it is not possible to instantiate Pool without `new`.

  plan.doesNotThrow(function () {
    const p = pool.createPool({
      create: function () {
        return new Promise(function (resolve) {
          addTask(resolve, {})
        })
      },
      destroy: function () {
        return new Promise(function (resolve) {
          addTask(resolve)
        })
      }
    })
    plan.equal(p instanceof PoolClass, true, 'should create a Pool')
  }, 'should be able to instantiate with createPool')
})

test('context maintenance', (t, end) => {
  const { addTask, agent, pool } = t.nr
  const p = pool.createPool(
    {
      create: function () {
        return new Promise(function (resolve) {
          addTask(resolve, {})
        })
      },
      destroy: function () {
        return new Promise(function (resolve) {
          addTask(resolve)
        })
      }
    },
    {
      max: 2,
      min: 0
    }
  )

  Array.from({ length: 6 }, async (_, i) => {
    await run(i)
  })

  drain()

  async function run(n) {
    return helper.runInTransaction(agent, async (tx) => {
      const conn = await p.acquire()
      assert.equal(id(agent.getTransaction()), id(tx), n + ': should maintain tx state')
      await new Promise((resolve) => {
        addTask(() => {
          p.release(conn)
          resolve()
        })
      })
    })
  }

  function drain() {
    run('drain')

    helper.runInTransaction(agent, function (tx) {
      p.drain()
        .then(function () {
          assert.equal(id(agent.getTransaction()), id(tx), 'should have context through drain')

          return p.clear().then(function () {
            assert.equal(id(agent.getTransaction()), id(tx), 'should have context through destroy')
          })
        })
        .then(
          function () {
            end()
          },
          function (err) {
            assert.ifError(err)
            end()
          }
        )
    })
  }
})
