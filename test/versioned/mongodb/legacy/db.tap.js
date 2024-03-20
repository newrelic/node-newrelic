/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const semver = require('semver')
const { dbTest, mongoTest } = require('../db-common')
const params = require('../../../lib/params')
const helper = require('../../../lib/agent_helper')
const { pkgVersion, COLLECTIONS, DB_NAME } = require('../common')

if (semver.satisfies(pkgVersion, '<3')) {
  mongoTest('open', function openTest(t, agent) {
    const mongodb = require('mongodb')
    const server = new mongodb.Server(params.mongodb_host, params.mongodb_port)
    const db = new mongodb.Db(DB_NAME, server)

    helper.runInTransaction(agent, function inTransaction(transaction) {
      db.open(function onOpen(err, _db) {
        const segment = agent.tracer.getSegment()
        t.error(err, 'db.open should not error')
        t.equal(db, _db, 'should pass through the arguments correctly')
        t.equal(agent.getTransaction(), transaction, 'should not lose tx state')
        t.equal(segment.name, 'Callback: onOpen', 'should create segments')
        t.equal(transaction.trace.root.children.length, 1, 'should only create one')
        const parent = transaction.trace.root.children[0]
        t.equal(parent.name, 'Datastore/operation/MongoDB/open', 'should name segment correctly')
        t.not(parent.children.indexOf(segment), -1, 'should have callback as child')
        db.close()
        t.end()
      })
    })
  })

  dbTest('logout', function logoutTest(t, db, verify) {
    db.logout({}, function loggedOut(err) {
      t.error(err, 'should not have error')
      verify(['Datastore/operation/MongoDB/logout', 'Callback: loggedOut'], { legacy: true })
    })
  })
}

dbTest('addUser, authenticate, removeUser', function addUserTest(t, db, verify) {
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
    verify(
      [
        'Datastore/operation/MongoDB/removeUser',
        'Callback: preRemove',
        'Datastore/operation/MongoDB/addUser',
        'Callback: added',
        'Datastore/operation/MongoDB/authenticate',
        'Callback: authed',
        'Datastore/operation/MongoDB/removeUser',
        'Callback: removed'
      ],
      { legacy: true }
    )
  }

  function removedNoAuth(err) {
    if (!t.error(err, 'removeUser should not have error')) {
      return t.end()
    }
    verify(
      [
        'Datastore/operation/MongoDB/removeUser',
        'Callback: preRemove',
        'Datastore/operation/MongoDB/addUser',
        'Callback: added',
        'Datastore/operation/MongoDB/removeUser',
        'Callback: removedNoAuth'
      ],
      { legacy: true }
    )
  }
})

dbTest('collection', function collectionTest(t, db, verify) {
  db.collection(COLLECTIONS.collection1, function gotCollection(err, collection) {
    t.error(err, 'should not have error')
    t.ok(collection, 'collection is not null')
    verify(['Datastore/operation/MongoDB/collection', 'Callback: gotCollection'], { legacy: true })
  })
})

dbTest('eval', function evalTest(t, db, verify) {
  db.eval('function (x) {return x;}', [3], function evaled(err, result) {
    t.error(err, 'should not have error')
    t.equal(3, result, 'should produce the right result')
    verify(['Datastore/operation/MongoDB/eval', 'Callback: evaled'], { legacy: true })
  })
})

dbTest('collections', function collectionTest(t, db, verify) {
  db.collections(function gotCollections(err2, collections) {
    t.error(err2, 'should not have error')
    t.ok(Array.isArray(collections), 'got array of collections')
    verify(['Datastore/operation/MongoDB/collections', 'Callback: gotCollections'], {
      legacy: true
    })
  })
})

dbTest('command', function commandTest(t, db, verify) {
  db.command({ ping: 1 }, function onCommand(err, result) {
    t.error(err, 'should not have error')
    t.same(result, { ok: 1 }, 'got correct result')
    verify(['Datastore/operation/MongoDB/command', 'Callback: onCommand'], { legacy: true })
  })
})

dbTest('createCollection', function createTest(t, db, verify) {
  db.createCollection(COLLECTIONS.collection1, function gotCollection(err, collection) {
    t.error(err, 'should not have error')
    t.equal(
      collection.collectionName || collection.s.name,
      COLLECTIONS.collection1,
      'new collection should have the right name'
    )
    verify(['Datastore/operation/MongoDB/createCollection', 'Callback: gotCollection'], {
      legacy: true
    })
  })
})

dbTest('createIndex', function createIndexTest(t, db, verify) {
  db.createIndex(COLLECTIONS.collection1, 'foo', function createdIndex(err, result) {
    t.error(err, 'should not have error')
    t.equal(result, 'foo_1', 'should have the right result')
    verify(['Datastore/operation/MongoDB/createIndex', 'Callback: createdIndex'], { legacy: true })
  })
})

dbTest('dropCollection', function dropTest(t, db, verify) {
  db.createCollection(COLLECTIONS.collection1, function gotCollection(err) {
    t.error(err, 'should not have error getting collection')

    db.dropCollection(COLLECTIONS.collection1, function droppedCollection(err, result) {
      t.error(err, 'should not have error dropping collection')
      t.ok(result === true, 'result should be boolean true')
      verify(
        [
          'Datastore/operation/MongoDB/createCollection',
          'Callback: gotCollection',
          'Datastore/operation/MongoDB/dropCollection',
          'Callback: droppedCollection'
        ],
        { legacy: true }
      )
    })
  })
})

dbTest('dropDatabase', function dropDbTest(t, db, verify) {
  db.dropDatabase(function droppedDatabase(err, result) {
    t.error(err, 'should not have error')
    t.ok(result, 'result should be truthy')
    verify(['Datastore/operation/MongoDB/dropDatabase', 'Callback: droppedDatabase'], {
      legacy: true
    })
  })
})

dbTest('ensureIndex', function ensureIndexTest(t, db, verify) {
  db.ensureIndex(COLLECTIONS.collection1, 'foo', function ensuredIndex(err, result) {
    t.error(err, 'should not have error')
    t.equal(result, 'foo_1')
    verify(['Datastore/operation/MongoDB/ensureIndex', 'Callback: ensuredIndex'], { legacy: true })
  })
})

dbTest('indexInformation', function indexInfoTest(t, db, verify) {
  db.ensureIndex(COLLECTIONS.collection1, 'foo', function ensuredIndex(err) {
    t.error(err, 'ensureIndex should not have error')
    db.indexInformation(COLLECTIONS.collection1, function gotInfo(err2, result) {
      t.error(err2, 'indexInformation should not have error')
      t.same(result, { _id_: [['_id', 1]], foo_1: [['foo', 1]] }, 'result is the expected object')
      verify(
        [
          'Datastore/operation/MongoDB/ensureIndex',
          'Callback: ensuredIndex',
          'Datastore/operation/MongoDB/indexInformation',
          'Callback: gotInfo'
        ],
        { legacy: true }
      )
    })
  })
})

dbTest('renameCollection', function (t, db, verify) {
  db.createCollection(COLLECTIONS.collection1, function gotCollection(err) {
    t.error(err, 'should not have error getting collection')
    db.renameCollection(
      COLLECTIONS.collection1,
      COLLECTIONS.collection2,
      function renamedCollection(err2) {
        t.error(err2, 'should not have error renaming collection')
        db.dropCollection(COLLECTIONS.collection2, function droppedCollection(err3) {
          t.error(err3)
          verify(
            [
              'Datastore/operation/MongoDB/createCollection',
              'Callback: gotCollection',
              'Datastore/operation/MongoDB/renameCollection',
              'Callback: renamedCollection',
              'Datastore/operation/MongoDB/dropCollection',
              'Callback: droppedCollection'
            ],
            { legacy: true }
          )
        })
      }
    )
  })
})

dbTest('stats', function statsTest(t, db, verify) {
  db.stats({}, function gotStats(err, stats) {
    t.error(err, 'should not have error')
    t.ok(stats, 'got stats')
    verify(['Datastore/operation/MongoDB/stats', 'Callback: gotStats'], { legacy: true })
  })
})
