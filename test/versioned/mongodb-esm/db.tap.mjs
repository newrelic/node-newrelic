/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import { DB_NAME, dropTestCollections } from './collection-common.mjs'
import helper from '../../lib/agent_helper.js'
import { getHostName, getPort, connect, close, ESM } from './common.cjs'
const { COLLECTIONS } = ESM

let MONGO_HOST = null
let MONGO_PORT = null
const BAD_MONGO_COMMANDS = ['collection']

tap.test('Db tests', (t) => {
  t.autoend()
  let agent
  let mongodb

  t.before(async () => {
    agent = helper.instrumentMockedAgent()
    const mongoPkg = await import('mongodb')
    mongodb = mongoPkg.default
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  t.beforeEach(() => {
    return dropTestCollections(mongodb)
  })

  t.test('addUser, authenticate, removeUser', (t) => {
    dbTest({ t, agent, mongodb }, function addUserTest(t, db, verify) {
      const userName = 'user-test'
      const userPass = 'user-test-pass'

      db.removeUser(userName, function preRemove() {
        // Don't care if this first remove fails, it's just to ensure a clean slate.
        db.addUser(userName, userPass, { roles: ['readWrite'] }, added)
      })

      function added(err) {
        if (!t.error(err, 'addUser should not have error')) {
          return t.end()
        }

        if (typeof db.authenticate === 'function') {
          db.authenticate(userName, userPass, authed)
        } else {
          t.comment('Skipping authentication test, not supported on db')
          db.removeUser(userName, removedNoAuth)
        }
      }

      function authed(err) {
        if (!t.error(err, 'authenticate should not have error')) {
          return t.end()
        }
        db.removeUser(userName, removed)
      }

      function removed(err) {
        if (!t.error(err, 'removeUser should not have error')) {
          return t.end()
        }
        verify([
          'Datastore/operation/MongoDB/removeUser',
          'Callback: preRemove',
          'Datastore/operation/MongoDB/addUser',
          'Callback: added',
          'Datastore/operation/MongoDB/authenticate',
          'Callback: authed',
          'Datastore/operation/MongoDB/removeUser',
          'Callback: removed'
        ])
      }

      function removedNoAuth(err) {
        if (!t.error(err, 'removeUser should not have error')) {
          return t.end()
        }
        verify([
          'Datastore/operation/MongoDB/removeUser',
          'Callback: preRemove',
          'Datastore/operation/MongoDB/addUser',
          'Callback: added',
          'Datastore/operation/MongoDB/removeUser',
          'Callback: removedNoAuth'
        ])
      }
    })
  })

  t.test('collections', (t) => {
    dbTest({ t, agent, mongodb }, function collectionTest(t, db, verify) {
      db.collections(function gotCollections(err2, collections) {
        t.error(err2, 'should not have error')
        t.ok(Array.isArray(collections), 'got array of collections')
        verify(['Datastore/operation/MongoDB/collections', 'Callback: gotCollections'])
      })
    })
  })

  t.test('command', (t) => {
    dbTest({ t, agent, mongodb }, function collectionTest(t, db, verify) {
      db.command({ ping: 1 }, function onCommand(err, result) {
        t.error(err, 'should not have error')
        t.same(result, { ok: 1 }, 'got correct result')
        verify(['Datastore/operation/MongoDB/command', 'Callback: onCommand'])
      })
    })
  })

  t.test('createCollection', (t) => {
    dbTest({ t, agent, mongodb, dropCollections: true }, function collectionTest(t, db, verify) {
      db.createCollection(COLLECTIONS.collection1, function gotCollection(err, collection) {
        t.error(err, 'should not have error')
        t.equal(
          collection.collectionName || collection.s.name,
          COLLECTIONS.collection1,
          'new collection should have the right name'
        )
        verify(['Datastore/operation/MongoDB/createCollection', 'Callback: gotCollection'])
      })
    })
  })

  t.test('createIndex', (t) => {
    dbTest({ t, agent, mongodb }, function collectionTest(t, db, verify) {
      db.createIndex(COLLECTIONS.collection1, 'foo', function createdIndex(err, result) {
        t.error(err, 'should not have error')
        t.equal(result, 'foo_1', 'should have the right result')
        verify(['Datastore/operation/MongoDB/createIndex', 'Callback: createdIndex'])
      })
    })
  })

  t.test('dropCollection', (t) => {
    dbTest({ t, agent, mongodb }, function collectionTest(t, db, verify) {
      db.createCollection(COLLECTIONS.collection1, function gotCollection(err) {
        t.error(err, 'should not have error getting collection')

        db.dropCollection(COLLECTIONS.collection1, function droppedCollection(err, result) {
          t.error(err, 'should not have error dropping collection')
          t.ok(result === true, 'result should be boolean true')
          verify([
            'Datastore/operation/MongoDB/createCollection',
            'Callback: gotCollection',
            'Datastore/operation/MongoDB/dropCollection',
            'Callback: droppedCollection'
          ])
        })
      })
    })
  })

  t.test('dropDatabase', (t) => {
    dbTest({ t, agent, mongodb }, function collectionTest(t, db, verify) {
      db.dropDatabase(function droppedDatabase(err, result) {
        t.error(err, 'should not have error')
        t.ok(result, 'result should be truthy')
        verify(['Datastore/operation/MongoDB/dropDatabase', 'Callback: droppedDatabase'])
      })
    })
  })

  t.test('indexInformation', (t) => {
    dbTest({ t, agent, mongodb }, function collectionTest(t, db, verify) {
      db.createIndex(COLLECTIONS.collection1, 'foo', function createdIndex(err) {
        t.error(err, 'createIndex should not have error')
        db.indexInformation(COLLECTIONS.collection1, function gotInfo(err2, result) {
          t.error(err2, 'indexInformation should not have error')
          t.same(
            result,
            { _id_: [['_id', 1]], foo_1: [['foo', 1]] },
            'result is the expected object'
          )
          verify([
            'Datastore/operation/MongoDB/createIndex',
            'Callback: createdIndex',
            'Datastore/operation/MongoDB/indexInformation',
            'Callback: gotInfo'
          ])
        })
      })
    })
  })

  t.test('renameCollection', (t) => {
    dbTest({ t, agent, mongodb }, function collectionTest(t, db, verify) {
      db.createCollection(COLLECTIONS.collection1, function gotCollection(err) {
        t.error(err, 'should not have error getting collection')
        db.renameCollection(
          COLLECTIONS.collection1,
          COLLECTIONS.collection2,
          function renamedCollection(err2) {
            t.error(err2, 'should not have error renaming collection')
            db.dropCollection(COLLECTIONS.collection2, function droppedCollection(err3) {
              t.error(err3)
              verify([
                'Datastore/operation/MongoDB/createCollection',
                'Callback: gotCollection',
                'Datastore/operation/MongoDB/renameCollection',
                'Callback: renamedCollection',
                'Datastore/operation/MongoDB/dropCollection',
                'Callback: droppedCollection'
              ])
            })
          }
        )
      })
    })
  })

  t.test('stats', (t) => {
    dbTest({ t, agent, mongodb }, function collectionTest(t, db, verify) {
      db.stats({}, function gotStats(err, stats) {
        t.error(err, 'should not have error')
        t.ok(stats, 'got stats')
        verify(['Datastore/operation/MongoDB/stats', 'Callback: gotStats'])
      })
    })
  })
})

function dbTest({ t, agent, mongodb }, run) {
  let db = null
  let client = null

  t.autoend()

  t.beforeEach(async function () {
    MONGO_HOST = getHostName(agent)
    MONGO_PORT = getPort()

    const res = await connect({ mongodb, name: DB_NAME })
    client = res.client
    db = res.db
  })

  t.afterEach(function () {
    return close(client, db)
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
      run(t, db, function (names) {
        verifyMongoSegments(t, agent, transaction, names)
        transaction.end()
        t.end()
      })
    })
  })
}

function verifyMongoSegments(t, agent, transaction, names) {
  t.ok(agent.getTransaction(), 'should not lose transaction state')
  t.equal(agent.getTransaction().id, transaction.id, 'transaction is correct')

  const segment = agent.tracer.getSegment()
  let current = transaction.trace.root

  for (let i = 0, l = names.length; i < l; ++i) {
    // Filter out net.createConnection segments as they could occur during execution, which is fine
    // but breaks out assertion function
    current.children = current.children.filter((child) => child.name !== 'net.createConnection')
    t.equal(current.children.length, 1, 'should have one child segment')
    current = current.children[0]
    t.equal(current.name, names[i], 'segment should be named ' + names[i])

    // If this is a Mongo operation/statement segment then it should have the
    // datastore instance attributes.
    if (/^Datastore\/.*?\/MongoDB/.test(current.name)) {
      if (isBadSegment(current)) {
        t.comment('Skipping attributes check for ' + current.name)
        continue
      }

      // Commands known as "admin commands" always happen against the "admin"
      // database regardless of the DB the connection is actually connected to.
      // This is apparently by design.
      // https://jira.mongodb.org/browse/NODE-827
      let dbName = DB_NAME
      if (/\/renameCollection$/.test(current.name)) {
        dbName = 'admin'
      }

      const attributes = current.getAttributes()
      t.equal(attributes.database_name, dbName, 'should have correct db name')
      t.equal(attributes.host, MONGO_HOST, 'should have correct host name')
      t.equal(attributes.port_path_or_id, MONGO_PORT, 'should have correct port')
      t.equal(attributes.product, 'MongoDB', 'should have correct product attribute')
    }
  }

  // Do not use `t.equal` for this comparison. When it is false tap would dump
  // way too much information to be useful.
  t.ok(current === segment, 'current segment is ' + segment.name)
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
