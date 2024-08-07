/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// This file provides the `beforeEach` and `afterEach` hooks that every
// suite requires in order to set up and teardown the database.

import helper from '../../lib/agent_helper.js'
import common from '../mongodb/common.js'

const { DB_NAME, COLLECTIONS } = common.ESM

export { beforeEach, afterEach, dropTestCollections }

async function beforeEach(ctx) {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  const { default: mongodb } = await import('mongodb')
  ctx.nr.mongodb = mongodb

  await dropTestCollections(mongodb)
  ctx.nr.METRIC_HOST_NAME = common.getHostName(ctx.nr.agent)
  ctx.nr.METRIC_HOST_PORT = common.getPort()
  const conn = await common.connect({ mongodb, name: DB_NAME })
  ctx.nr.client = conn.client
  ctx.nr.db = conn.db
  ctx.nr.collection = conn.db.collection(COLLECTIONS.collection1)
  await populate(conn.db, ctx.nr.collection)
}

async function afterEach(ctx) {
  helper.unloadAgent(ctx.nr.agent)
  await common.close(ctx.nr.client, ctx.nr.db)
}

async function populate(db, collection) {
  const items = []
  for (let i = 0; i < 30; ++i) {
    items.push({
      i: i,
      next3: [i + 1, i + 2, i + 3],
      data: Math.random().toString(36).slice(2),
      mod10: i % 10,
      // spiral out
      loc: [i % 4 && (i + 1) % 4 ? i : -i, (i + 1) % 4 && (i + 2) % 4 ? i : -i]
    })
  }

  await collection.deleteMany({})
  await collection.insert(items)
}

/**
 * Bootstrap a running MongoDB instance by dropping all the collections used
 * by tests.
 * @param {*} mongodb MongoDB module to execute commands on.
 */
async function dropTestCollections(mongodb) {
  const collections = Object.values(COLLECTIONS)
  const { client, db } = await common.connect({ mongodb, name: DB_NAME })

  const dbCollections = (await db.listCollections().toArray()).map((c) => c.name)
  for (const collection of collections) {
    if (dbCollections.includes(collection) === false) {
      continue
    }
    try {
      await db.dropCollection(collection)
    } catch {}
  }

  await common.close(client, db)
}
