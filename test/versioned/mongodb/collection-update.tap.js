/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('./collection-common')
const semver = require('semver')
const { pkgVersion, STATEMENT_PREFIX } = require('./common')

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
 */
function assertExpectedResult({ t, data, count, keyPrefix, extraValues }) {
  const expectedResult = { acknowledged: true, ...extraValues }
  if (count) {
    expectedResult[`${keyPrefix}Count`] = count
  }
  t.same(data, expectedResult)
}

common.test('deleteMany', async function deleteManyTest(t, collection, verify) {
  const data = await collection.deleteMany({ mod10: 5 })
  assertExpectedResult({
    t,
    data,
    count: 3,
    keyPrefix: 'deleted'
  })
  verify(null, [`${STATEMENT_PREFIX}/deleteMany`], ['deleteMany'], { strict: false })
})

common.test('deleteOne', async function deleteOneTest(t, collection, verify) {
  const data = await collection.deleteOne({ mod10: 5 })
  assertExpectedResult({
    t,
    data,
    count: 1,
    keyPrefix: 'deleted'
  })
  verify(null, [`${STATEMENT_PREFIX}/deleteOne`], ['deleteOne'], { strict: false })
})

common.test('insertMany', async function insertManyTest(t, collection, verify) {
  const data = await collection.insertMany([{ foo: 'bar' }, { foo: 'bar2' }])
  assertExpectedResult({
    t,
    data,
    count: 2,
    keyPrefix: 'inserted',
    extraValues: {
      insertedIds: {
        0: data.insertedIds[0],
        1: data.insertedIds[1]
      }
    }
  })

  verify(null, [`${STATEMENT_PREFIX}/insertMany`], ['insertMany'], { strict: false })
})

common.test('insertOne', async function insertOneTest(t, collection, verify) {
  const data = await collection.insertOne({ foo: 'bar' })
  assertExpectedResult({
    t,
    data,
    extraValues: {
      insertedId: data.insertedId
    }
  })

  verify(null, [`${STATEMENT_PREFIX}/insertOne`], ['insertOne'], { strict: false })
})

common.test('replaceOne', async function replaceOneTest(t, collection, verify) {
  const data = await collection.replaceOne({ i: 5 }, { foo: 'bar' })
  assertExpectedResult({
    t,
    data,
    count: 1,
    keyPrefix: 'modified',
    extraValues: {
      matchedCount: 1,
      upsertedCount: 0,
      upsertedId: null
    }
  })

  verify(null, [`${STATEMENT_PREFIX}/replaceOne`], ['replaceOne'], { strict: false })
})

common.test('updateMany', async function updateManyTest(t, collection, verify) {
  const data = await collection.updateMany({ mod10: 5 }, { $set: { a: 5 } })
  assertExpectedResult({
    t,
    data,
    count: 3,
    keyPrefix: 'modified',
    extraValues: {
      matchedCount: 3,
      upsertedCount: 0,
      upsertedId: null
    }
  })

  verify(null, [`${STATEMENT_PREFIX}/updateMany`], ['updateMany'], { strict: false })
})

common.test('updateOne', async function updateOneTest(t, collection, verify) {
  const data = await collection.updateOne({ i: 5 }, { $set: { a: 5 } })
  assertExpectedResult({
    t,
    data,
    count: 1,
    keyPrefix: 'modified',
    extraValues: {
      matchedCount: 1,
      upsertedCount: 0,
      upsertedId: null
    }
  })

  verify(null, [`${STATEMENT_PREFIX}/updateOne`], ['updateOne'], { strict: false })
})

if (semver.satisfies(pkgVersion, '<5.0.0')) {
  common.test('insert', async function insertTest(t, collection, verify) {
    const data = await collection.insert({ foo: 'bar' })
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

    verify(null, [`${STATEMENT_PREFIX}/insert`], ['insert'], { strict: false })
  })

  common.test('remove', async function removeTest(t, collection, verify) {
    const data = await collection.remove({ mod10: 5 })
    assertExpectedResult({
      t,
      data,
      count: 3,
      keyPrefix: 'deleted'
    })

    verify(null, [`${STATEMENT_PREFIX}/remove`], ['remove'], { strict: false })
  })

  common.test('update', async function updateTest(t, collection, verify) {
    const data = await collection.update({ i: 5 }, { $set: { foo: 'bar' } })
    assertExpectedResult({
      t,
      data,
      count: 1,
      keyPrefix: 'modified',
      extraValues: {
        matchedCount: 1,
        upsertedCount: 0,
        upsertedId: null
      }
    })

    verify(null, [`${STATEMENT_PREFIX}/update`], ['update'], { strict: false })
  })
}
