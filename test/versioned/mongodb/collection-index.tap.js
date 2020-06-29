/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var common = require('./collection-common')


common.test('createIndex', function createIndexTest(t, collection, verify) {
  collection.createIndex('i', function onIndex(err, data) {
    t.error(err)
    t.equal(data, 'i_1')
    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/createIndex',
        'Callback: onIndex'
      ],
      ['createIndex']
    )
  })
})

common.test('dropAllIndexes', function dropAllIndexesTest(t, collection, verify) {
  collection.dropAllIndexes(function done(err, data) {
    t.error(err)
    t.equal(data, true)
    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/dropAllIndexes',
        'Callback: done'
      ],
      ['dropAllIndexes']
    )
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
          'Datastore/statement/MongoDB/testCollection/createIndex',
          'Callback: onIndex',
          'Datastore/statement/MongoDB/testCollection/dropIndex',
          'Callback: done'
        ],
        ['createIndex', 'dropIndex']
      )
    })
  })
})

common.test('ensureIndex', function ensureIndexTest(t, collection, verify) {
  collection.ensureIndex('i', function done(err, data) {
    t.error(err)
    t.equal(data, 'i_1')
    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/ensureIndex',
        'Callback: done'
      ],
      ['ensureIndex']
    )
  })
})

common.test('indexes', function indexesTest(t, collection, verify) {
  collection.indexes(function done(err, data) {
    t.error(err)
    var result = data && data[0]
    t.deepEqual(result, {
      v: result && result.v,
      key: {_id: 1},
      name: '_id_',
      ns: common.DB_NAME + '.testCollection'
    }, 'should have expected results')

    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/indexes',
        'Callback: done'
      ],
      ['indexes']
    )
  })
})

common.test('indexExists', function indexExistsTest(t, collection, verify) {
  collection.indexExists(['_id_'], function done(err, data) {
    t.error(err)
    t.equal(data, true)

    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/indexExists',
        'Callback: done'
      ],
      ['indexExists']
    )
  })
})

common.test('indexInformation', function indexInformationTest(t, collection, verify) {
  collection.indexInformation(function done(err, data) {
    t.error(err)
    t.deepEqual(data && data._id_, [['_id', 1]], 'should have expected results')

    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/indexInformation',
        'Callback: done'
      ],
      ['indexInformation']
    )
  })
})

common.test('reIndex', function reIndexTest(t, collection, verify) {
  collection.reIndex(function done(err, data) {
    t.error(err)
    t.equal(data, true)

    verify(
      null,
      [
        'Datastore/statement/MongoDB/testCollection/reIndex',
        'Callback: done'
      ],
      ['reIndex']
    )
  })
})
