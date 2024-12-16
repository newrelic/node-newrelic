/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const common = require('./common')
const collectionCommon = require('./collection-common')
const helper = require('../../lib/agent_helper')

let MONGO_HOST = null
let MONGO_PORT = null
const BAD_MONGO_COMMANDS = ['collection']

/**
 * Very similar to the test runner in `./collection-common.js`. Refer to the
 * docblocks there for clarification.
 *
 * @param {string} name Parent test name.
 * @param {function} run Provided a db instance and a verify callback.
 */
function dbTest(name, run) {
  test(name, async (t) => {
    t.beforeEach(async (ctx) => {
      ctx.nr = {}
      ctx.nr.agent = helper.instrumentMockedAgent()

      const mongodb = require('mongodb')
      ctx.nr.mongodb = mongodb

      await collectionCommon.dropTestCollections(mongodb)
      MONGO_HOST = common.getHostName(ctx.nr.agent)
      MONGO_PORT = common.getPort()

      const res = await common.connect({ mongodb })
      ctx.nr.client = res.client
      ctx.nr.db = res.db
    })

    t.afterEach(async (ctx) => {
      await common.close(ctx.nr.client, ctx.nr.db)
      helper.unloadAgent(ctx.nr.agent)
      removeModules(['mongodb'])
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
        run(db, function (names, opts = {}) {
          verifyMongoSegments(agent, transaction, names, opts)
          transaction.end()
          end()
        })
      })
    })
  })
}

function verifyMongoSegments(agent, transaction, names, opts) {
  assert.ok(agent.getTransaction(), 'should not lose transaction state')
  assert.equal(agent.getTransaction().id, transaction.id, 'transaction is correct')

  const segment = agent.tracer.getSegment()
  let current = transaction.trace.root
  let child

  for (let i = 0, l = names.length; i < l; ++i) {
    if (opts.legacy) {
      // Filter out net.createConnection segments as they could occur during execution, which is fine
      // but breaks out assertion function
      current.children = current.children.filter((c) => c.name !== 'net.createConnection')
      assert.equal(current.children.length, 1, 'should have one child segment')
      child = current.children[0]
      current = current.children[0]
    } else {
      child = current.children[i]
    }
    assert.equal(child.name, names[i], 'segment should be named ' + names[i])

    // If this is a Mongo operation/statement segment then it should have the
    // datastore instance attributes.
    if (/^Datastore\/.*?\/MongoDB/.test(child.name)) {
      if (isBadSegment(child)) {
        continue
      }

      // Commands known as "admin commands" always happen against the "admin"
      // database regardless of the DB the connection is actually connected to.
      // This is apparently by design.
      // https://jira.mongodb.org/browse/NODE-827
      let dbName = common.DB_NAME
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

  if (opts.legacy) {
    // Do not use `assert.equal` for this comparison. When it is false tap would dump
    // way too much information to be useful.
    assert.ok(current === segment, 'current segment is ' + segment.name)
  }
}

function isBadSegment(segment) {
  const nameParts = segment.name.split('/')
  const command = nameParts[nameParts.length - 1]
  const attributes = segment.getAttributes()

  return (
    BAD_MONGO_COMMANDS.indexOf(command) !== -1 && // Is in the list of bad commands
    !attributes.database_name && // and does not have any of the
    !attributes.host && // instance attributes.
    !attributes.port_path_or_id
  )
}

module.exports = {
  dbTest
}
