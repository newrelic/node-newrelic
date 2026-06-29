/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')

const { COLLECTIONS } = require('./common')
const { dbTest } = require('./db-common')

dbTest('addUser, removeUser', async function addUserTest(db, verify) {
  const userName = 'user-test'
  const userPass = 'user-test-pass'

  try {
    await db.removeUser(userName)
  } catch {
    // Don't care if this first remove fails, it's just to ensure a clean slate.
  }
  await db.command({
    createUser: userName,
    pwd: userPass,
    roles: ['readWrite']
  })

  await db.removeUser(userName)
  verify(
    [
      'Datastore/operation/MongoDB/removeUser',
      'Datastore/operation/MongoDB/command',
      'Datastore/operation/MongoDB/removeUser'
    ],
    ['removeUser', 'command', 'removeUser']
  )
})

dbTest('collections', async function collectionTest(db, verify) {
  const collections = await db.collections()
  assert.ok(Array.isArray(collections), 'got array of collections')
  verify(['Datastore/operation/MongoDB/collections'], ['collections'])
})

dbTest('command', async function commandTest(db, verify) {
  const result = await db.command({ ping: 1 })
  assert.deepStrictEqual(result, { ok: 1 }, 'got correct result')
  verify(['Datastore/operation/MongoDB/command'], ['command'])
})

dbTest('createCollection', async function createTest(db, verify) {
  const collection = await db.createCollection(COLLECTIONS.collection1)
  assert.equal(
    collection.collectionName || collection.s.name,
    COLLECTIONS.collection1,
    'new collection should have the right name'
  )
  verify(['Datastore/operation/MongoDB/createCollection'], ['createCollection'])
})

dbTest('createIndex', async function createIndexTest(db, verify) {
  const result = await db.createIndex(COLLECTIONS.collection1, 'foo')
  assert.equal(result, 'foo_1', 'should have the right result')
  verify(['Datastore/operation/MongoDB/createIndex'], ['createIndex'])
})

dbTest('dropCollection', async function dropTest(db, verify) {
  await db.createCollection(COLLECTIONS.collection1)
  const result = await db.dropCollection(COLLECTIONS.collection1)
  assert.ok(result === true, 'result should be boolean true')
  verify(
    [
      'Datastore/operation/MongoDB/createCollection',
      'Datastore/operation/MongoDB/dropCollection'
    ],
    ['createCollection', 'dropCollection']
  )
})

dbTest('dropDatabase', async function dropDbTest(db, verify) {
  const result = await db.dropDatabase()
  assert.ok(result, 'result should be truthy')
  verify(['Datastore/operation/MongoDB/dropDatabase'], ['dropDatabase'])
})

dbTest('indexInformation', async function indexInfoTest(db, verify) {
  await db.createIndex(COLLECTIONS.collection1, 'foo')
  const result = await db.indexInformation(COLLECTIONS.collection1)
  assert.deepStrictEqual(
    result,
    { _id_: [['_id', 1]], foo_1: [['foo', 1]] },
    'result is the expected object'
  )
  verify(
    [
      'Datastore/operation/MongoDB/createIndex',
      'Datastore/operation/MongoDB/indexInformation'
    ],
    ['createIndex', 'indexInformation']
  )
})

dbTest('renameCollection', async function (db, verify) {
  await db.createCollection(COLLECTIONS.collection1)
  await db.renameCollection(COLLECTIONS.collection1, COLLECTIONS.collection2)
  await db.dropCollection(COLLECTIONS.collection2)
  verify(
    [
      'Datastore/operation/MongoDB/createCollection',
      'Datastore/operation/MongoDB/renameCollection',
      'Datastore/operation/MongoDB/dropCollection'
    ],
    ['createCollection', 'renameCollection', 'dropCollection']
  )
})

dbTest('stats', async function statsTest(db, verify) {
  const stats = await db.stats({})
  assert.ok(stats, 'got stats')
  verify(['Datastore/operation/MongoDB/stats'], ['stats'])
})

dbTest('collection', async function collectionMethodTest(db, verify) {
  const collection = db.collection(COLLECTIONS.collection1)
  assert.ok(collection, 'should return a collection')
  assert.equal(
    collection.collectionName || collection.s?.name,
    COLLECTIONS.collection1,
    'collection should have the correct name'
  )
  verify(['Datastore/operation/MongoDB/collection'], ['collection'])
})

dbTest('db operations should be opaque', async function opaqueTest(db, verify) {
  // The db subscriber sets opaque=true to prevent nested segment creation.
  // db.collections() internally calls cursor.toArray() which is instrumented.
  // If opaque is not set to true, we would see a nested toArray segment.
  // This test verifies that with opaque=true, we only see the collections segment.
  const collections = await db.collections()
  assert.ok(Array.isArray(collections), 'should return array of collections')

  // Verify only ONE segment for collections, with no nested child segments like toArray
  verify(
    ['Datastore/operation/MongoDB/collections'],
    ['collections'],
    { checkNoChildren: true }
  )
})

dbTest('db operations should create database rollup metrics', async function rollupTest(db, verify) {
  // The db subscriber uses the database recorder which creates rollup metrics
  // including Datastore/all, Datastore/MongoDB/all, and instance-specific metrics.
  // This test verifies that these metrics are properly created.
  await db.command({ ping: 1 })

  // The verify function checks for:
  // - Datastore/operation/MongoDB/command (unscoped and scoped)
  // - Datastore/all, Datastore/allWeb
  // - Datastore/MongoDB/all, Datastore/MongoDB/allWeb
  // - Datastore/instance/MongoDB/{host}/{port}
  verify(['Datastore/operation/MongoDB/command'], ['command'])
})
