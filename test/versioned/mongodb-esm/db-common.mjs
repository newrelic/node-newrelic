/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'

import helper from '../../lib/agent_helper.js'
import common from '../mongodb/common.js'
import { dropTestCollections } from './collection-common.mjs'

const { DB_NAME } = common.ESM
const BAD_MONGO_COMMANDS = ['collection']

let MONGO_HOST = null
let MONGO_PORT = null

export { dbTest }

function dbTest(name, run) {
  test(name, async (t) => {
    t.beforeEach(async (ctx) => {
      ctx.nr = {}
      ctx.nr.agent = helper.instrumentMockedAgent()

      const { default: mongodb } = await import('mongodb')
      ctx.nr.mongodb = mongodb

      await dropTestCollections(mongodb)
      MONGO_HOST = common.getHostName(ctx.nr.agent)
      MONGO_PORT = common.getPort()

      const res = await common.connect({ mongodb, name: DB_NAME })
      ctx.nr.client = res.client
      ctx.nr.db = res.db
    })

    t.afterEach(async (ctx) => {
      await common.close(ctx.nr.client, ctx.nr.db)
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('without transaction', (t, end) => {
      const { agent, db } = t.nr
      run(db, function () {
        assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
        end()
      })
    })

    await t.test('with transaction', (t, end) => {
      const { agent, db } = t.nr
      assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
      helper.runInTransaction(agent, function (transaction) {
        run(db, function (names) {
          verifyMongoSegments(agent, transaction, names)
          transaction.end()
          end()
        })
      })
    })
  })
}

function verifyMongoSegments(agent, transaction, names) {
  assert.ok(agent.getTransaction(), 'should not lose transaction state')
  assert.equal(agent.getTransaction().id, transaction.id, 'transaction is correct')

  // Sequential Promise-based MongoDB operations sit flat under the trace root.
  // Filter out net.createConnection segments which can occur during execution.
  const children = transaction.trace
    .getChildren(transaction.trace.root.id)
    .filter((c) => c.name !== 'net.createConnection')

  assert.equal(children.length, names.length, `should have ${names.length} top-level segments`)

  for (let i = 0, l = names.length; i < l; ++i) {
    const child = children[i]
    assert.equal(child.name, names[i], 'segment should be named ' + names[i])

    if (/^Datastore\/.*?\/MongoDB/.test(child.name)) {
      if (isBadSegment(child)) {
        continue
      }

      // Admin commands always run against the admin database.
      // https://jira.mongodb.org/browse/NODE-827
      let dbName = DB_NAME
      if (/\/renameCollection$/.test(child.name)) {
        dbName = 'admin'
      }

      const attributes = child.getAttributes()
      assert.equal(attributes.database_name, dbName, 'should have correct db name')
      assert.equal(attributes.host, MONGO_HOST, 'should have correct host name')
      assert.equal(attributes.port_path_or_id, MONGO_PORT, 'should have correct port')
      assert.equal(attributes.product, 'MongoDB', 'should have correct product attribute')
    }
  }
}

function isBadSegment(segment) {
  const nameParts = segment.name.split('/')
  const command = nameParts[nameParts.length - 1]
  const attributes = segment.getAttributes()

  return (
    BAD_MONGO_COMMANDS.indexOf(command) !== -1 &&
    !attributes.database_name &&
    !attributes.host &&
    !attributes.port_path_or_id
  )
}
