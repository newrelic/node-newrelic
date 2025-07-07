/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const { assertSegments } = require('../../lib/custom-assertions')
const mongoCommon = require('../mongodb/common')

test('Disabled mongodb scenarios', async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    const agent = helper.instrumentMockedAgent({
      instrumentation: {
        mongodb: {
          enabled: false
        },
        timers: {
          enabled: false
        },
        dns: {
          enabled: false
        },
        net: {
          enabled: false
        }
      }
    })
    const Redis = require('ioredis')
    const mongodb = require('mongodb')
    const mongo = await mongoCommon.connect({ mongodb })
    const collection = mongo.db.collection('disabled-inst-test')
    const redisClient = new Redis(params.redis_port, params.redis_host)
    await redisClient.select(1)
    ctx.nr.redisClient = redisClient
    ctx.nr.agent = agent
    ctx.nr.collection = collection
    ctx.nr.db = mongo.db
    ctx.nr.mongoClient = mongo.client
  })

  t.afterEach(async (ctx) => {
    const { agent, redisClient, mongoClient, db } = ctx.nr
    await mongoCommon.close(mongoClient, db)
    redisClient.disconnect()
    helper.unloadAgent(agent)
  })

  await t.test('should record child segments if pg is disabled and using promises', async (t) => {
    const { agent, redisClient, collection } = t.nr
    await helper.runInTransaction(agent, async (tx) => {
      await redisClient.set('foo', 'bar')
      await collection.countDocuments()
      await redisClient.get('foo')
      tx.end()
      assertSegments(tx.trace, tx.trace.root, [
        'Datastore/operation/Redis/set',
        'Datastore/operation/Redis/get'
      ])
    })
  })

  await t.test('should record child segments if mongodb is disabled and using callbacks', async (t) => {
    const { agent, redisClient, collection } = t.nr
    await helper.runInTransaction(agent, async (tx) => {
      await new Promise((resolve) => {
        redisClient.set('foo', 'bar', async (err) => {
          assert.equal(err, null)
          await collection.countDocuments()
          redisClient.get('foo', (innerErr) => {
            assert.equal(innerErr, null)
            assertSegments(tx.trace, tx.trace.root, [
              'Datastore/operation/Redis/set',
              'Datastore/operation/Redis/get'
            ])
            tx.end()
            resolve()
          })
        })
      })
    })
  })
})
