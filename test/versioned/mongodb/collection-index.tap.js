/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('./collection-common')
const semver = require('semver')
const { COLLECTIONS, DB_NAME, pkgVersion, STATEMENT_PREFIX } = require('./common')

common.test('createIndex', async function createIndexTest(t, collection, verify) {
  const data = await collection.createIndex('i')
  t.equal(data, 'i_1')
  verify(null, [`${STATEMENT_PREFIX}/createIndex`], ['createIndex'], { strict: false })
})

common.test('dropIndex', async function dropIndexTest(t, collection, verify) {
  await collection.createIndex('i')
  const data = await collection.dropIndex('i_1')
  t.equal(data.ok, 1)
  verify(
    null,
    [`${STATEMENT_PREFIX}/createIndex`, `${STATEMENT_PREFIX}/dropIndex`],
    ['createIndex', 'dropIndex'],
    { strict: false, childrenLength: 2 }
  )
})

common.test('indexes', async function indexesTest(t, collection, verify) {
  const data = await collection.indexes()
  const result = data && data[0]
  const expectedResult = {
    v: result && result.v,
    key: { _id: 1 },
    name: '_id_'
  }

  // this will fail if running a mongodb server > 4.3.1
  // https://jira.mongodb.org/browse/SERVER-41696
  // we only connect to a server > 4.3.1 when using the mongodb
  // driver of 4.2.0+
  if (semver.satisfies(pkgVersion, '<4.2.0')) {
    expectedResult.ns = `${DB_NAME}.${COLLECTIONS.collection1}`
  }

  t.same(result, expectedResult, 'should have expected results')

  verify(null, [`${STATEMENT_PREFIX}/indexes`], ['indexes'], { strict: false })
})

common.test('indexExists', async function indexExistsTest(t, collection, verify) {
  const data = await collection.indexExists(['_id_'])
  t.equal(data, true)

  verify(null, [`${STATEMENT_PREFIX}/indexExists`], ['indexExists'], { strict: false })
})

common.test('indexInformation', async function indexInformationTest(t, collection, verify) {
  const data = await collection.indexInformation()
  t.same(data && data._id_, [['_id', 1]], 'should have expected results')

  verify(null, [`${STATEMENT_PREFIX}/indexInformation`], ['indexInformation'], { strict: false })
})
