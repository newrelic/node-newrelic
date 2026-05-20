/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Accessing `collection.{remove,update,insert}` is deprecated in some versions
// of MongoDB that we test against.
process.env.NODE_NO_WARNINGS = 1

import assert from 'node:assert'
import semver from 'semver'

import { collectionTest, pkgVersion } from './collection-common.mjs'
import common from '../mongodb/common.js'

const { STATEMENT_PREFIX } = common.ESM

function assertExpectedResult({ data, count, keyPrefix, extraValues }) {
  const expectedResult = { acknowledged: true, ...extraValues }
  if (count) {
    expectedResult[`${keyPrefix}Count`] = count
  }
  assert.deepEqual(data, expectedResult)
}

collectionTest('deleteMany', async function deleteManyTest(collection, verify) {
  const data = await collection.deleteMany({ mod10: 5 })
  assertExpectedResult({ data, count: 3, keyPrefix: 'deleted' })
  verify(null, [`${STATEMENT_PREFIX}/deleteMany`], ['deleteMany'], { strict: false })
})

collectionTest('deleteOne', async function deleteOneTest(collection, verify) {
  const data = await collection.deleteOne({ mod10: 5 })
  assertExpectedResult({ data, count: 1, keyPrefix: 'deleted' })
  verify(null, [`${STATEMENT_PREFIX}/deleteOne`], ['deleteOne'], { strict: false })
})

collectionTest('insertMany', async function insertManyTest(collection, verify) {
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

collectionTest('insertOne', async function insertOneTest(collection, verify) {
  const data = await collection.insertOne({ foo: 'bar' })
  assertExpectedResult({
    data,
    extraValues: {
      insertedId: data.insertedId
    }
  })

  verify(null, [`${STATEMENT_PREFIX}/insertOne`], ['insertOne'], { strict: false })
})

collectionTest('replaceOne', async function replaceOneTest(collection, verify) {
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

collectionTest('updateMany', async function updateManyTest(collection, verify) {
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

collectionTest('updateOne', async function updateOneTest(collection, verify) {
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

if (semver.satisfies(pkgVersion, '<5.0.0')) {
  // collection.insert/remove/update are deprecated v4 sync wrappers that delegate
  // to insertMany/deleteMany/updateMany; we instrument the canonical methods only.
  collectionTest('insert', async function insertTest(collection, verify) {
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

    verify(null, [`${STATEMENT_PREFIX}/insertMany`], ['insertMany'], { strict: false })
  })

  collectionTest('remove', async function removeTest(collection, verify) {
    const data = await collection.remove({ mod10: 5 })
    assertExpectedResult({
      data,
      count: 3,
      keyPrefix: 'deleted'
    })

    verify(null, [`${STATEMENT_PREFIX}/deleteMany`], ['deleteMany'], { strict: false })
  })

  collectionTest('update', async function updateTest(collection, verify) {
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

    verify(null, [`${STATEMENT_PREFIX}/updateMany`], ['updateMany'], { strict: false })
  })
}
