/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('../collection-common')
const { STATEMENT_PREFIX, DB_NAME, COLLECTIONS } = require('../common')

common.test('createIndex', function createIndexTest(t, collection, verify) {
  collection.createIndex('i', function onIndex(err, data) {
    t.error(err)
    t.equal(data, 'i_1')
    verify(null, [`${STATEMENT_PREFIX}/createIndex`, 'Callback: onIndex'], ['createIndex'])
  })
})

common.test('dropIndex', function dropIndexTest(t, collection, verify) {
  collection.createIndex('i', function onIndex(err) {
    t.error(err)
    collection.dropIndex('i_1', function done(err, data) {
      t.error(err)
      t.equal(data.ok, 1)
      verify(
        null,
        [
          `${STATEMENT_PREFIX}/createIndex`,
          'Callback: onIndex',
          `${STATEMENT_PREFIX}/dropIndex`,
          'Callback: done'
        ],
        ['createIndex', 'dropIndex']
      )
    })
  })
})

common.test('indexes', function indexesTest(t, collection, verify) {
  collection.indexes(function done(err, data) {
    t.error(err)
    const result = data && data[0]
    const expectedResult = {
      v: result && result.v,
      key: { _id: 1 },
      name: '_id_',
      ns: `${DB_NAME}.${COLLECTIONS.collection1}`
    }

    t.same(result, expectedResult, 'should have expected results')

    verify(null, [`${STATEMENT_PREFIX}/indexes`, 'Callback: done'], ['indexes'])
  })
})

common.test('indexExists', function indexExistsTest(t, collection, verify) {
  collection.indexExists(['_id_'], function done(err, data) {
    t.error(err)
    t.equal(data, true)

    verify(null, [`${STATEMENT_PREFIX}/indexExists`, 'Callback: done'], ['indexExists'])
  })
})

common.test('indexInformation', function indexInformationTest(t, collection, verify) {
  collection.indexInformation(function done(err, data) {
    t.error(err)
    t.same(data && data._id_, [['_id', 1]], 'should have expected results')

    verify(null, [`${STATEMENT_PREFIX}/indexInformation`, 'Callback: done'], ['indexInformation'])
  })
})

common.test('dropAllIndexes', function dropAllIndexesTest(t, collection, verify) {
  collection.dropAllIndexes(function done(err, data) {
    t.error(err)
    t.equal(data, true)
    verify(null, [`${STATEMENT_PREFIX}/dropAllIndexes`, 'Callback: done'], ['dropAllIndexes'])
  })
})

common.test('ensureIndex', function ensureIndexTest(t, collection, verify) {
  collection.ensureIndex('i', function done(err, data) {
    t.error(err)
    t.equal(data, 'i_1')
    verify(null, [`${STATEMENT_PREFIX}/ensureIndex`, 'Callback: done'], ['ensureIndex'])
  })
})

common.test('reIndex', function reIndexTest(t, collection, verify) {
  collection.reIndex(function done(err, data) {
    t.error(err)
    t.equal(data, true)

    verify(null, [`${STATEMENT_PREFIX}/reIndex`, 'Callback: done'], ['reIndex'])
  })
})
