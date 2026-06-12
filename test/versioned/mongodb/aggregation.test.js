/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const helper = require('../../lib/agent_helper')
const { removeModules } = require('../../lib/cache-buster')
const common = require('./common')
const collectionCommon = require('./collection-common')

test('AggregationCursor methods are covered', async (t) => {
  // We do not directly instrument AggregationCursor, or FindCursor, in the
  // subscriber based instrumentation method as we did in the prior shim based
  // method. This test verifies that this class gets instrumented correctly.
  t.plan(7)

  const agent = helper.instrumentMockedAgent()
  const mongodb = require('mongodb')

  await collectionCommon.dropTestCollections(mongodb)
  const res = await common.connect({ mongodb })
  const client = res.client
  const db = res.db
  const collection = db.collection(common.COLLECTIONS.collection1)
  await collectionCommon.populate(collection)

  t.after(async () => {
    await common.close(client, db)
    helper.unloadAgent(agent)
    removeModules(['mongodb'])
  })

  await helper.runInTransaction(agent, async function (transaction) {
    transaction.name = common.TRANSACTION_NAME

    const pipeline = [
      { $match: { i: { $gte: 0 } } },
      { $group: { _id: '$mod10', count: { $sum: 1 } } }
    ]

    const cursor = collection.aggregate(pipeline)
    const explanation = await cursor.explain()

    t.assert.ok(explanation, 'should return explanation')
    t.assert.ok(agent.getTransaction(), 'should maintain tx state')
    t.assert.equal(
      agent.getTransaction().id,
      transaction.id,
      'should not change transactions'
    )

    transaction.end()

    const metrics = agent.metrics._metrics
    const datastoreMetrics = Object.keys(metrics.unscoped).filter(
      (key) => key.includes('Datastore/')
    )
    t.assert.equal(
      datastoreMetrics.includes('Datastore/operation/MongoDB/aggregate'),
      true
    )
    t.assert.equal(
      datastoreMetrics.includes('Datastore/operation/MongoDB/explain'),
      true
    )
    t.assert.equal(
      datastoreMetrics.includes('Datastore/statement/MongoDB/testCollection/aggregate'),
      true
    )
    t.assert.equal(
      datastoreMetrics.includes('Datastore/statement/MongoDB/testCollection/explain'),
      true
    )
  })
})
