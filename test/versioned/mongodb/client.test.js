/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const { removeModules } = require('../../lib/cache-buster')
const common = require('./common')

test('MongoClient handler registration', { timeout: 10_000 }, async (t) => {
  t.beforeEach(async (ctx) => {
    ctx.nr = {}
    ctx.nr.agent = helper.instrumentMockedAgent()
    ctx.nr.mongodb = require('mongodb')
  })

  t.afterEach(async (ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    removeModules(['mongodb'])
  })

  await t.test('should register commandStarted handler only once per client instance', async (t) => {
    const { mongodb } = t.nr
    const res = await common.connect({ mongodb })
    const client = res.client
    const db = res.db

    t.after(async () => {
      await client.close(true)
    })

    const initialCount = client.listenerCount('commandStarted')
    assert.equal(
      initialCount,
      1,
      'should have at least one commandStarted listener registered'
    )

    // Perform multiple operations that could trigger re-registration.
    const collection = db.collection(common.COLLECTIONS.collection1)
    await collection.insertOne({ test: 1 })
    await collection.findOne({ test: 1 })
    await collection.updateOne({ test: 1 }, { $set: { test: 2 } })
    await collection.deleteOne({ test: 2 })

    const finalCount = client.listenerCount('commandStarted')
    assert.equal(
      finalCount,
      initialCount,
      'commandStarted listener should only be registered once'
    )
  })

  await t.test('should register handler for each unique client instance', async (t) => {
    const { mongodb } = t.nr

    const res1 = await common.connect({ mongodb })
    const client1 = res1.client
    const count1 = client1.listenerCount('commandStarted')
    assert.equal(count1, 1, 'first client should have commandStarted listener')

    const res2 = await common.connect({ mongodb })
    const client2 = res2.client
    const count2 = client2.listenerCount('commandStarted')
    assert.equal(count2, 1, 'second client should have commandStarted listener')

    assert.notEqual(client1, client2, 'clients should be different instances')

    await client1.close(true)
    await client2.close(true)
  })
})
