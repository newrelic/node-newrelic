/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('./collection-common')
const mongoPackage = require('mongodb/package.json')
const semver = require('semver')

/**
 * The response from the methods in this file differ between versions
 * This helper decides which pieces to assert
 *
 * @param {Object} params
 * @param {Tap.Test} params.t
 * @param {Object} params.data result from callback used to assert
 * @param {Number} params.count, optional
 * @param {string} params.keyPrefix prefix where the count exists
 * @param {Object} params.extraValues extra fields to assert on >=4.0.0 version of module
 * @param {Object} params.legaycValues extra fields to assert on <4.0.0 version of module
 */
function assertExpectedResult({ t, data, count, keyPrefix, extraValues, legacyValues }) {
  if (semver.satisfies(mongoPackage.version, '<4')) {
    const expectedResult = { ok: 1, ...legacyValues }
    if (count) {
      expectedResult.n = count
    }
    t.same(data.result, expectedResult)
  } else {
    const expectedResult = { acknowledged: true, ...extraValues }
    if (count) {
      expectedResult[`${keyPrefix}Count`] = count
    }
    t.same(data, expectedResult)
  }
}

common.test('deleteMany', function deleteManyTest(t, collection, verify) {
  collection.deleteMany({ mod10: 5 }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 3,
      keyPrefix: 'deleted'
    })
    verify(
      null,
      ['Datastore/statement/MongoDB/testCollection/deleteMany', 'Callback: done'],
      ['deleteMany']
    )
  })
})

common.test('deleteOne', function deleteOneTest(t, collection, verify) {
  collection.deleteOne({ mod10: 5 }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 1,
      keyPrefix: 'deleted'
    })
    verify(
      null,
      ['Datastore/statement/MongoDB/testCollection/deleteOne', 'Callback: done'],
      ['deleteOne']
    )
  })
})

common.test('insert', function insertTest(t, collection, verify) {
  collection.insert({ foo: 'bar' }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 1,
      keyPrefix: 'inserted',
      extraValues: {
        insertedIds: {
          0: {}
        }
      }
    })

    verify(
      null,
      ['Datastore/statement/MongoDB/testCollection/insert', 'Callback: done'],
      ['insert']
    )
  })
})

common.test('insertMany', function insertManyTest(t, collection, verify) {
  collection.insertMany([{ foo: 'bar' }, { foo: 'bar2' }], function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 2,
      keyPrefix: 'inserted',
      extraValues: {
        insertedIds: {
          0: {},
          1: {}
        }
      }
    })

    verify(
      null,
      ['Datastore/statement/MongoDB/testCollection/insertMany', 'Callback: done'],
      ['insertMany']
    )
  })
})

common.test('insertOne', function insertOneTest(t, collection, verify) {
  collection.insertOne({ foo: 'bar' }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      legacyValues: {
        n: 1
      },
      extraValues: {
        insertedId: {}
      }
    })

    verify(
      null,
      ['Datastore/statement/MongoDB/testCollection/insertOne', 'Callback: done'],
      ['insertOne']
    )
  })
})

common.test('remove', function removeTest(t, collection, verify) {
  collection.remove({ mod10: 5 }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 3,
      keyPrefix: 'deleted'
    })

    verify(
      null,
      ['Datastore/statement/MongoDB/testCollection/remove', 'Callback: done'],
      ['remove']
    )
  })
})

common.test('replaceOne', function replaceOneTest(t, collection, verify) {
  collection.replaceOne({ i: 5 }, { foo: 'bar' }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 1,
      keyPrefix: 'modified',
      legacyValues: {
        nModified: 1
      },
      extraValues: {
        matchedCount: 1,
        upsertedCount: 0,
        upsertedId: null
      }
    })

    verify(
      null,
      ['Datastore/statement/MongoDB/testCollection/replaceOne', 'Callback: done'],
      ['replaceOne']
    )
  })
})

if (semver.satisfies(mongoPackage.version, '<4')) {
  common.test('save', function saveTest(t, collection, verify) {
    collection.save({ foo: 'bar' }, function done(err, data) {
      t.error(err)
      t.same(data.result, { ok: 1, n: 1 })

      verify(null, ['Datastore/statement/MongoDB/testCollection/save', 'Callback: done'], ['save'])
    })
  })
}

common.test('update', function updateTest(t, collection, verify) {
  collection.update({ i: 5 }, { $set: { foo: 'bar' } }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 1,
      keyPrefix: 'modified',
      legacyValues: {
        nModified: 1
      },
      extraValues: {
        matchedCount: 1,
        upsertedCount: 0,
        upsertedId: null
      }
    })

    verify(
      null,
      ['Datastore/statement/MongoDB/testCollection/update', 'Callback: done'],
      ['update']
    )
  })
})

common.test('updateMany', function updateManyTest(t, collection, verify) {
  collection.updateMany({ mod10: 5 }, { $set: { a: 5 } }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 3,
      keyPrefix: 'modified',
      legacyValues: {
        nModified: 3
      },
      extraValues: {
        matchedCount: 3,
        upsertedCount: 0,
        upsertedId: null
      }
    })

    verify(
      null,
      ['Datastore/statement/MongoDB/testCollection/updateMany', 'Callback: done'],
      ['updateMany']
    )
  })
})

common.test('updateOne', function updateOneTest(t, collection, verify) {
  collection.updateOne({ i: 5 }, { $set: { a: 5 } }, function done(err, data) {
    t.notOk(err, 'should not error')
    assertExpectedResult({
      t,
      data,
      count: 1,
      keyPrefix: 'modified',
      legacyValues: {
        nModified: 1
      },
      extraValues: {
        matchedCount: 1,
        upsertedCount: 0,
        upsertedId: null
      }
    })

    verify(
      null,
      ['Datastore/statement/MongoDB/testCollection/updateOne', 'Callback: done'],
      ['updateOne']
    )
  })
})
