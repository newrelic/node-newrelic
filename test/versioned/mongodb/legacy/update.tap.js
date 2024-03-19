/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('../collection-common')
const { STATEMENT_PREFIX } = require('../common')

/**
 * The response from the methods in this file differ between versions
 * This helper decides which pieces to assert
 *
 * @param {Object} params fn params
 * @param {Tap.Test} params.t tap instance
 * @param {Object} params.data result from callback used to assert
 * @param {Number} [params.count] count of results
 * @param {Object} params.extraValues extra fields to assert
 */
function assertExpectedResult({ t, data, count, extraValues }) {
  const expectedResult = { ok: 1, ...extraValues }
  if (count) {
    expectedResult.n = count
  }
  t.same(data.result, expectedResult)
}

common.test('deleteMany', function deleteManyTest(t, collection, verify) {
  collection.deleteMany({ mod10: 5 }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 3
    })
    verify(null, [`${STATEMENT_PREFIX}/deleteMany`, 'Callback: done'], ['deleteMany'])
  })
})

common.test('deleteOne', function deleteOneTest(t, collection, verify) {
  collection.deleteOne({ mod10: 5 }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 1
    })
    verify(null, [`${STATEMENT_PREFIX}/deleteOne`, 'Callback: done'], ['deleteOne'])
  })
})

common.test('insert', function insertTest(t, collection, verify) {
  collection.insert({ foo: 'bar' }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 1
    })

    verify(null, [`${STATEMENT_PREFIX}/insert`, 'Callback: done'], ['insert'])
  })
})

common.test('insertMany', function insertManyTest(t, collection, verify) {
  collection.insertMany([{ foo: 'bar' }, { foo: 'bar2' }], function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 2
    })

    verify(null, [`${STATEMENT_PREFIX}/insertMany`, 'Callback: done'], ['insertMany'])
  })
})

common.test('insertOne', function insertOneTest(t, collection, verify) {
  collection.insertOne({ foo: 'bar' }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      extraValues: {
        n: 1
      }
    })

    verify(null, [`${STATEMENT_PREFIX}/insertOne`, 'Callback: done'], ['insertOne'])
  })
})

common.test('remove', function removeTest(t, collection, verify) {
  collection.remove({ mod10: 5 }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 3
    })

    verify(null, [`${STATEMENT_PREFIX}/remove`, 'Callback: done'], ['remove'])
  })
})

common.test('replaceOne', function replaceOneTest(t, collection, verify) {
  collection.replaceOne({ i: 5 }, { foo: 'bar' }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 1,
      extraValues: {
        nModified: 1
      }
    })

    verify(null, [`${STATEMENT_PREFIX}/replaceOne`, 'Callback: done'], ['replaceOne'])
  })
})

common.test('save', function saveTest(t, collection, verify) {
  collection.save({ foo: 'bar' }, function done(err, data) {
    t.error(err)
    t.same(data.result, { ok: 1, n: 1 })

    verify(null, [`${STATEMENT_PREFIX}/save`, 'Callback: done'], ['save'])
  })
})

common.test('update', function updateTest(t, collection, verify) {
  collection.update({ i: 5 }, { $set: { foo: 'bar' } }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 1,
      extraValues: {
        nModified: 1
      }
    })

    verify(null, [`${STATEMENT_PREFIX}/update`, 'Callback: done'], ['update'])
  })
})

common.test('updateMany', function updateManyTest(t, collection, verify) {
  collection.updateMany({ mod10: 5 }, { $set: { a: 5 } }, function done(err, data) {
    t.error(err)
    assertExpectedResult({
      t,
      data,
      count: 3,
      extraValues: {
        nModified: 3
      }
    })

    verify(null, [`${STATEMENT_PREFIX}/updateMany`, 'Callback: done'], ['updateMany'])
  })
})

common.test('updateOne', function updateOneTest(t, collection, verify) {
  collection.updateOne({ i: 5 }, { $set: { a: 5 } }, function done(err, data) {
    t.notOk(err, 'should not error')
    assertExpectedResult({
      t,
      data,
      count: 1,
      extraValues: {
        nModified: 1
      }
    })

    verify(null, [`${STATEMENT_PREFIX}/updateOne`, 'Callback: done'], ['updateOne'])
  })
})
