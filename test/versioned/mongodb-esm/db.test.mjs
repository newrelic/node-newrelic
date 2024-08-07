/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'
import helper from '../../lib/agent_helper.js'
import { ESM } from './common.cjs'
import { beforeEach, afterEach, dropTestCollections } from './test-hooks.mjs'
import { matchObject } from './test-assertions.mjs'

const { DB_NAME, COLLECTIONS } = ESM
const BAD_MONGO_COMMANDS = ['collection']

test('addUser, authenticate, removeUser', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('without transaction', (t, end) => {
    const { agent, db } = t.nr
    doWork(db, () => {
      assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
      end()
    })
  })

  await t.test('with transaction', (t, end) => {
    const { agent, db } = t.nr
    assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
    helper.runInTransaction(agent, (tx) => {
      doWork(db, (expectedSegments) => {
        verifyMongoSegments({ t, tx, expectedSegments })
        tx.end()
        end()
      })
    })
  })

  function doWork(db, done) {
    const username = 'user-test'
    const password = 'user-test-pass'

    db.removeUser(username, function preRemove() {
      // Don't care if this first remove fails. It's just to ensure a clean slate.
      db.addUser(username, password, { roles: ['readWrite'] }, added)
    })

    function added(error) {
      assert.equal(error, undefined, 'addUser should not have error')
      if (typeof db.authenticate === 'function') {
        db.authenticate(username, password, authed)
      } else {
        t.diagnostic('skipping authentication test, not supported on db')
        db.removeUser(username, removedNoAuth)
      }
    }

    function authed(error) {
      assert.equal(error, undefined, 'authenticate should not have errored')
      db.removeUser(username, removed)
    }

    function removed(error) {
      assert.equal(error, undefined, 'removeUser should not have errored')
      const expectedSegments = [
        'Datastore/operation/MongoDB/removeUser',
        'Callback: preRemove',
        'Datastore/operation/MongoDB/addUser',
        'Callback: added',
        'Datastore/operation/MongoDB/authenticate',
        'Callback: authed',
        'Datastore/operation/MongoDB/removeUser',
        'Callback: removed'
      ]
      done(expectedSegments)
    }

    function removedNoAuth(error) {
      assert.equal(error, undefined, 'removeUser should not have errored')
      const expectedSegments = [
        'Datastore/operation/MongoDB/removeUser',
        'Callback: preRemove',
        'Datastore/operation/MongoDB/addUser',
        'Callback: added',
        'Datastore/operation/MongoDB/removeUser',
        'Callback: removedNoAuth'
      ]
      done(expectedSegments)
    }
  }
})

test('collections', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('without transaction', (t, end) => {
    const { agent, db } = t.nr
    db.collections((error, collections) => {
      assert.equal(error, undefined)
      assert.equal(Array.isArray(collections), true, 'got array of collections')
      assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
      end()
    })
  })

  await t.test('with transaction', (t, end) => {
    const { agent, db } = t.nr
    helper.runInTransaction(agent, (tx) => {
      db.collections(function gotCollections(error, collections) {
        assert.equal(error, undefined)
        assert.equal(Array.isArray(collections), true, 'got array of collections')
        verifyMongoSegments({
          t,
          tx,
          expectedSegments: ['Datastore/operation/MongoDB/collections', 'Callback: gotCollections']
        })
        tx.end()
        end()
      })
    })
  })
})

test('command', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('without transaction', (t, end) => {
    const { agent, db } = t.nr
    db.command({ ping: 1 }, (error, result) => {
      assert.equal(error, undefined)
      assert.deepStrictEqual(result, { ok: 1 }, 'got correct result')
      assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
      end()
    })
  })

  await t.test('with transaction', (t, end) => {
    const { agent, db } = t.nr
    helper.runInTransaction(agent, (tx) => {
      db.command({ ping: 1 }, function onCommand(error, result) {
        assert.equal(error, undefined)
        assert.deepStrictEqual(result, { ok: 1 }, 'got correct result')
        verifyMongoSegments({
          t,
          tx,
          expectedSegments: ['Datastore/operation/MongoDB/command', 'Callback: onCommand']
        })
        tx.end()
        end()
      })
    })
  })
})

test('createCollection', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('without transaction', (t, end) => {
    const { agent, db, mongodb } = t.nr
    dropTestCollections(mongodb).then(() => {
      db.createCollection(COLLECTIONS.collection1, (error, collection) => {
        assert.equal(error, undefined)
        assert.equal(
          collection.collectionName || collection.s.name,
          COLLECTIONS.collection1,
          'new collection should have the right name'
        )
        assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
        end()
      })
    })
  })

  await t.test('with transaction', (t, end) => {
    const { agent, db, mongodb } = t.nr
    dropTestCollections(mongodb).then(() => {
      helper.runInTransaction(agent, (tx) => {
        db.createCollection(COLLECTIONS.collection1, function gotCollection(error, collection) {
          assert.equal(error, undefined)
          assert.equal(
            collection.collectionName || collection.s.name,
            COLLECTIONS.collection1,
            'new collection should have the right name'
          )
          verifyMongoSegments({
            t,
            tx,
            expectedSegments: [
              'Datastore/operation/MongoDB/createCollection',
              'Callback: gotCollection'
            ]
          })
          tx.end()
          end()
        })
      })
    })
  })
})

test('createIndex', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('without transaction', (t, end) => {
    const { agent, db } = t.nr
    db.createIndex(COLLECTIONS.collection1, 'foo', (error, result) => {
      assert.equal(error, undefined)
      assert.equal(result, 'foo_1', 'should have right result')
      assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
      end()
    })
  })

  await t.test('with transaction', (t, end) => {
    const { agent, db } = t.nr
    helper.runInTransaction(agent, (tx) => {
      db.createIndex(COLLECTIONS.collection1, 'foo', function createdIndex(error, result) {
        assert.equal(error, undefined)
        assert.equal(result, 'foo_1', 'should have right result')
        verifyMongoSegments({
          t,
          tx,
          expectedSegments: ['Datastore/operation/MongoDB/createIndex', 'Callback: createdIndex']
        })
        tx.end()
        end()
      })
    })
  })
})

test('dropCollection', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('without transaction', (t, end) => {
    const { agent, db } = t.nr
    db.dropCollection(COLLECTIONS.collection1, (error, result) => {
      assert.equal(error, undefined)
      assert.equal(result, true, 'result should be boolean true')
      assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
      end()
    })
  })

  await t.test('with transaction', (t, end) => {
    const { agent, db } = t.nr
    helper.runInTransaction(agent, (tx) => {
      db.dropCollection(COLLECTIONS.collection1, function droppedCollection(error, result) {
        assert.equal(error, undefined, 'should not have error dropping collection')
        assert.equal(result, true, 'result should be boolean true')
        verifyMongoSegments({
          t,
          tx,
          expectedSegments: [
            'Datastore/operation/MongoDB/dropCollection',
            'Callback: droppedCollection'
          ]
        })
        tx.end()
        end()
      })
    })
  })
})

test('dropDatabase', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('without transaction', (t, end) => {
    const { agent, db } = t.nr
    db.dropDatabase((error, result) => {
      assert.equal(error, undefined)
      assert.equal(result, true, 'result should be boolean true')
      assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
      end()
    })
  })

  await t.test('with transaction', (t, end) => {
    const { agent, db } = t.nr
    helper.runInTransaction(agent, (tx) => {
      db.dropDatabase(function droppedDatabase(error, result) {
        assert.equal(error, undefined, 'should not have error dropping collection')
        assert.equal(result, true, 'result should be boolean true')
        verifyMongoSegments({
          t,
          tx,
          expectedSegments: [
            'Datastore/operation/MongoDB/dropDatabase',
            'Callback: droppedDatabase'
          ]
        })
        tx.end()
        end()
      })
    })
  })
})

test('indexInformation', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('without transaction', (t, end) => {
    const { agent, db } = t.nr
    db.createIndex(COLLECTIONS.collection1, 'foo', (error) => {
      assert.equal(error, undefined, 'createIndex should not have error')
      db.indexInformation(COLLECTIONS.collection1, (error, result) => {
        assert.equal(error, undefined, 'indexInformation should not have error')
        assert.deepStrictEqual(
          result,
          { _id_: [['_id', 1]], foo_1: [['foo', 1]] },
          'result is the expected object'
        )
        assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
        end()
      })
    })
  })

  await t.test('with transaction', (t, end) => {
    const { agent, db } = t.nr
    helper.runInTransaction(agent, (tx) => {
      db.createIndex(COLLECTIONS.collection1, 'foo', function createdIndex(error) {
        assert.equal(error, undefined, 'createIndex should not have error')
        db.indexInformation(COLLECTIONS.collection1, function gotInfo(error, result) {
          assert.equal(error, undefined, 'indexInformation should not have error')
          assert.deepStrictEqual(
            result,
            { _id_: [['_id', 1]], foo_1: [['foo', 1]] },
            'result is the expected object'
          )
          verifyMongoSegments({
            t,
            tx,
            expectedSegments: [
              'Datastore/operation/MongoDB/createIndex',
              'Callback: createdIndex',
              'Datastore/operation/MongoDB/indexInformation',
              'Callback: gotInfo'
            ]
          })
          tx.end()
          end()
        })
      })
    })
  })
})

test('renameCollection', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('without transaction', (t, end) => {
    const { agent, db, mongodb } = t.nr
    dropTestCollections(mongodb)
      .then(() => {
        db.createCollection(COLLECTIONS.collection1, function gotCollection(error) {
          assert.equal(error, undefined, 'should not have error getting collection')
          db.renameCollection(
            COLLECTIONS.collection1,
            COLLECTIONS.collection2,
            function renamedCollection(error) {
              assert.equal(error, undefined)
              db.dropCollection(COLLECTIONS.collection2, function droppedCollection(error) {
                assert.equal(error, undefined)
                assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
                end()
              })
            }
          )
        })
      })
      .catch(assert.ifError)
  })

  await t.test('with transaction', (t, end) => {
    const { agent, db, mongodb } = t.nr
    dropTestCollections(mongodb)
      .then(() => {
        helper.runInTransaction(agent, (tx) => {
          db.createCollection(COLLECTIONS.collection1, function gotCollection(error) {
            assert.equal(error, undefined, 'should not have error getting collection')
            db.renameCollection(
              COLLECTIONS.collection1,
              COLLECTIONS.collection2,
              function renamedCollection(error) {
                assert.equal(error, undefined)
                db.dropCollection(COLLECTIONS.collection2, function droppedCollection(error) {
                  assert.equal(error, undefined)
                  verifyMongoSegments({
                    t,
                    tx,
                    expectedSegments: [
                      'Datastore/operation/MongoDB/createCollection',
                      'Callback: gotCollection',
                      'Datastore/operation/MongoDB/renameCollection',
                      'Callback: renamedCollection',
                      'Datastore/operation/MongoDB/dropCollection',
                      'Callback: droppedCollection'
                    ]
                  })
                  tx.end()
                  end()
                })
              }
            )
          })
        })
      })
      .catch(assert.ifError)
  })
})

test('stats', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('without transaction', (t, end) => {
    const { agent, db } = t.nr
    db.stats({}, (error, stats) => {
      assert.equal(error, undefined)
      matchObject(stats, { db: DB_NAME, collections: 1, ok: 1 })
      assert.equal(agent.getTransaction(), undefined, 'should not have transaction')
      end()
    })
  })

  await t.test('with transaction', (t, end) => {
    const { agent, db } = t.nr
    helper.runInTransaction(agent, (tx) => {
      db.stats(function gotStats(error, stats) {
        assert.equal(error, undefined)
        matchObject(stats, { db: DB_NAME, collections: 1, ok: 1 })
        verifyMongoSegments({
          t,
          tx,
          expectedSegments: ['Datastore/operation/MongoDB/stats', 'Callback: gotStats']
        })
        tx.end()
        end()
      })
    })
  })
})

function verifyMongoSegments({ t, tx, expectedSegments }) {
  const { agent, METRIC_HOST_NAME, METRIC_HOST_PORT } = t.nr
  assert.notEqual(agent.getTransaction(), undefined, 'should not lose transaction state')
  assert.equal(agent.getTransaction().id, tx.id, 'transaction is correct')

  const segment = agent.tracer.getSegment()
  let current = tx.trace.root

  for (let i = 0, l = expectedSegments.length; i < l; i += 1) {
    // Filter out net.createConnection segments as they could occur during
    // execution, and we don't need to verify them.
    current.children = current.children.filter((c) => c.name !== 'net.createConnection')
    assert.equal(current.children.length, 1, 'should have one child segment')
    current = current.children[0]
    assert.equal(
      current.name,
      expectedSegments[i],
      `segment should be named ${expectedSegments[i]}`
    )

    // If this is a Mongo operation/statement segment then it should have the
    // datastore instance attributes.
    if (/^Datastore\/.*?\/MongoDB/.test(current.name) === true) {
      if (isBadSegment(current) === true) {
        t.diagnostic(`skipping attributes check for ${current.name}`)
        continue
      }

      // Commands, known as "admin commands", always happen against the "admin"
      // database regardless of the DB the connection is actually connected to.
      // This is apparently by design.
      // htps://jira.mongodb.org/browse/NODE-827
      let dbName = DB_NAME
      if (/\/renameCollection$/.test(current.name) === true) {
        dbName = 'admin'
      }

      const attributes = current.getAttributes()
      assert.equal(attributes.database_name, dbName, 'should have correct db name')
      assert.equal(attributes.host, METRIC_HOST_NAME, 'should have correct host name')
      assert.equal(attributes.port_path_or_id, METRIC_HOST_PORT, 'should have correct port')
      assert.equal(attributes.product, 'MongoDB', 'should have correct product attribute')
    }
  }

  assert.equal(current, segment, `current segment is ${segment.name}`)
}

function isBadSegment(segment) {
  const nameParts = segment.name.split('/')
  const command = nameParts.at(-1)
  const attributes = segment.getAttributes()
  return (
    BAD_MONGO_COMMANDS.indexOf(command) !== -1 && // Is in the list of bad commands.
    !attributes.database_name && // and does not have any of the
    !attributes.host && // instance attributes
    !attributes.port_path_or_id
  )
}
