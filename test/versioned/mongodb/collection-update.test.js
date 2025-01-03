/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Accessing `collection.{remove,update,insert}` is deprecated in some version
// of MongoDB that we test against. We do not need to see these warnings in our
// tests. This line should be disabled as we drop old versions of MongoDB in
// order to determine if it can be removed.
process.env.NODE_NO_WARNINGS = 1

const assert = require('node:assert')

const common = require('./collection-common')
const semver = require('semver')
const { STATEMENT_PREFIX } = require('./common')

/**
 * The response from the methods in this file differ between versions
 * This helper decides which pieces to assert
 *
 * @param {Object} params
 * @param {Object} params.data result from callback used to assert
 * @param {Number} params.count, optional
 * @param {string} params.keyPrefix prefix where the count exists
 * @param {Object} params.extraValues extra fields to assert on >=4.0.0 version of module
 * @param params.count
 */
function assertExpectedResult({ data, count, keyPrefix, extraValues }) {
  const expectedResult = { acknowledged: true, ...extraValues }
  if (count) {
    expectedResult[`${keyPrefix}Count`] = count
  }
  assert.deepEqual(data, expectedResult)
}

common.test('deleteMany', async function deleteManyTest(collection, verify) {
  const data = await collection.deleteMany({ mod10: 5 })
  assertExpectedResult({
    data,
    count: 3,
    keyPrefix: 'deleted'
  })
  verify(null, [`${STATEMENT_PREFIX}/deleteMany`], ['deleteMany'], { strict: false })
})

common.test('deleteOne', async function deleteOneTest(collection, verify) {
  const data = await collection.deleteOne({ mod10: 5 })
  assertExpectedResult({
    data,
    count: 1,
    keyPrefix: 'deleted'
  })
  verify(null, [`${STATEMENT_PREFIX}/deleteOne`], ['deleteOne'], { strict: false })
})

common.test('insertMany', async function insertManyTest(collection, verify) {
  const data = await collection.insertMany([{ foo: 'bar' }, { foo: 'bar2' }])
  assertExpectedResult({
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

common.test('insertOne', async function insertOneTest(collection, verify) {
  const data = await collection.insertOne({ foo: 'bar' })
  assertExpectedResult({
    data,
    extraValues: {
      insertedId: data.insertedId
    }
  })

  verify(null, [`${STATEMENT_PREFIX}/insertOne`], ['insertOne'], { strict: false })
})

common.test('replaceOne', async function replaceOneTest(collection, verify) {
  const data = await collection.replaceOne({ i: 5 }, { foo: 'bar' })
  assertExpectedResult({
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

common.test('updateMany', async function updateManyTest(collection, verify) {
  const data = await collection.updateMany({ mod10: 5 }, { $set: { a: 5 } })
  assertExpectedResult({
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

common.test('updateOne', async function updateOneTest(collection, verify) {
  const data = await collection.updateOne({ i: 5 }, { $set: { a: 5 } })
  assertExpectedResult({
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

if (semver.satisfies(common.pkgVersion, '<5.0.0')) {
  common.test('insert', async function insertTest(collection, verify) {
    const data = await collection.insert({ foo: 'bar' })
    assertExpectedResult({
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

  common.test('remove', async function removeTest(collection, verify) {
    const data = await collection.remove({ mod10: 5 })
    assertExpectedResult({
      data,
      count: 3,
      keyPrefix: 'deleted'
    })

    verify(null, [`${STATEMENT_PREFIX}/remove`], ['remove'], { strict: false })
  })

  common.test('update', async function updateTest(collection, verify) {
    const data = await collection.update({ i: 5 }, { $set: { foo: 'bar' } })
    assertExpectedResult({
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
