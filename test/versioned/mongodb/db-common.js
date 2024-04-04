/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const common = require('./common')
const semver = require('semver')
const collectionCommon = require('./collection-common')
const helper = require('../../lib/agent_helper')
const tap = require('tap')

let MONGO_HOST = null
let MONGO_PORT = null
const BAD_MONGO_COMMANDS = ['collection']
if (semver.satisfies(common.pkgVersion, '2.2.x')) {
  BAD_MONGO_COMMANDS.push('authenticate', 'logout')
}

function dbTest(name, run) {
  mongoTest(name, function init(t, agent) {
    const mongodb = require('mongodb')
    let db = null
    let client = null

    t.autoend()

    t.test('remote connection', function (t) {
      t.autoend()
      t.beforeEach(async function () {
        // mongo >= 3.6.9 fails if you try to create an existing collection
        // drop before executing tests
        if (name === 'createCollection') {
          await collectionCommon.dropTestCollections(mongodb)
        }
        MONGO_HOST = common.getHostName(agent)
        MONGO_PORT = common.getPort()

        const res = await common.connect(mongodb)
        client = res.client
        db = res.db
      })

      t.afterEach(async function () {
        await common.close(client, db)
      })

      t.test('without transaction', function (t) {
        run(t, db, function () {
          t.notOk(agent.getTransaction(), 'should not have transaction')
          t.end()
        })
      })

      t.test('with transaction', function (t) {
        t.notOk(agent.getTransaction(), 'should not have transaction')
        helper.runInTransaction(agent, function (transaction) {
          run(t, db, function (names, opts = {}) {
            verifyMongoSegments(t, agent, transaction, names, opts)
            transaction.end()
            t.end()
          })
        })
      })
    })
  })
}

function mongoTest(name, run) {
  tap.test(name, function testWrap(t) {
    const mongodb = require('mongodb')
    collectionCommon.dropTestCollections(mongodb).then(() => {
      run(t, helper.loadTestAgent(t))
    })
  })
}

function verifyMongoSegments(t, agent, transaction, names, opts) {
  t.ok(agent.getTransaction(), 'should not lose transaction state')
  t.equal(agent.getTransaction().id, transaction.id, 'transaction is correct')

  const segment = agent.tracer.getSegment()
  let current = transaction.trace.root
  let child

  for (let i = 0, l = names.length; i < l; ++i) {
    if (opts.legacy) {
      // Filter out net.createConnection segments as they could occur during execution, which is fine
      // but breaks out assertion function
      current.children = current.children.filter((c) => c.name !== 'net.createConnection')
      t.equal(current.children.length, 1, 'should have one child segment')
      child = current.children[0]
      current = current.children[0]
    } else {
      child = current.children[i]
    }
    t.equal(child.name, names[i], 'segment should be named ' + names[i])

    // If this is a Mongo operation/statement segment then it should have the
    // datastore instance attributes.
    if (/^Datastore\/.*?\/MongoDB/.test(child.name)) {
      if (isBadSegment(child)) {
        t.comment('Skipping attributes check for ' + child.name)
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
      t.equal(attributes.database_name, dbName, 'should have correct db name')
      t.equal(attributes.host, MONGO_HOST, 'should have correct host name')
      t.equal(attributes.port_path_or_id, MONGO_PORT, 'should have correct port')
      t.equal(attributes.product, 'MongoDB', 'should have correct product attribute')
    }
  }

  if (opts.legacy) {
    // Do not use `t.equal` for this comparison. When it is false tap would dump
    // way too much information to be useful.
    t.ok(current === segment, 'current segment is ' + segment.name)
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
  dbTest,
  mongoTest
}
