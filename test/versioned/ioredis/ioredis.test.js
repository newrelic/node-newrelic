/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')
const { tspl } = require('@matteo.collina/tspl')
const { assertMetrics } = require('../../lib/custom-assertions')

// Indicates unique database in Redis. 0-15 supported.
const DB_INDEX = 3

test('ioredis instrumentation', async (t) => {
  t.beforeEach(async (ctx) => {
    const agent = helper.instrumentMockedAgent()
    const Redis = require('ioredis')
    const redisClient = new Redis(params.redis_port, params.redis_host)
    await helper.flushRedisDb(redisClient, DB_INDEX)
    const METRIC_HOST_NAME = urltils.isLocalhost(params.redis_host)
      ? agent.config.getHostnameSafe()
      : params.redis_host
    const HOST_ID = METRIC_HOST_NAME + '/' + params.redis_port

    await new Promise(async (resolve, reject) => {
      redisClient.select(DB_INDEX, (err) => {
        if (err) {
          return reject(err)
        }

        resolve()
      })
    })
    ctx.nr = {
      agent,
      redisClient,
      HOST_ID
    }
  })

  t.afterEach((ctx) => {
    const { agent, redisClient } = ctx.nr
    helper.unloadAgent(agent)
    redisClient.disconnect()
  })

  await t.test('creates expected metrics', async (t) => {
    const { agent, redisClient, HOST_ID } = t.nr
    const plan = tspl(t, { plan: 6 })
    agent.on('transactionFinished', function (tx) {
      const expected = [
        [{ name: 'Datastore/all' }],
        [{ name: 'Datastore/Redis/all' }],
        [{ name: 'Datastore/operation/Redis/set' }]
      ]
      expected['Datastore/instance/Redis/' + HOST_ID] = 2

      assertMetrics(tx.metrics, expected, false, false, { assert: plan })
    })

    helper.runInTransaction(agent, async (transaction) => {
      await redisClient.set('testkey', 'testvalue')
      transaction.end()
    })

    await plan.completed
  })

  await t.test('creates expected segments', async (t) => {
    const { agent, redisClient } = t.nr
    const plan = tspl(t, { plan: 5 })

    agent.on('transactionFinished', function (tx) {
      const root = tx.trace.root
      plan.equal(root.children.length, 2, 'root has two children')

      const setSegment = root.children[0]
      plan.equal(setSegment.name, 'Datastore/operation/Redis/set')

      // ioredis operations return promise, any 'then' callbacks will be sibling segments
      // of the original redis call
      const getSegment = root.children[1]
      plan.equal(getSegment.name, 'Datastore/operation/Redis/get')
      plan.equal(getSegment.children.length, 0, 'should not contain any segments')
    })

    helper.runInTransaction(agent, async (transaction) => {
      await redisClient.set('testkey', 'testvalue')
      const value = await redisClient.get('testkey')
      plan.equal(value, 'testvalue', 'should have expected value')
      transaction.end()
    })
    await plan.completed
  })

  // NODE-1524 regression
  await t.test('does not crash when ending out of transaction', (t, end) => {
    const { agent, redisClient } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      assert.ok(agent.getTransaction(), 'transaction should be in progress')
      redisClient.set('testkey', 'testvalue').then(function () {
        assert.ok(!agent.getTransaction(), 'transaction should have ended')
        end()
      })
      transaction.end()
    })
  })
})
