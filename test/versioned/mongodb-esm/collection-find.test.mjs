/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert'

import { collectionTest } from './collection-common.mjs'
import common from '../mongodb/common.js'

const { STATEMENT_PREFIX } = common.ESM
const findOpt = { returnDocument: 'after' }

collectionTest('findOne', async function findOneTest(collection, verify) {
  const data = await collection.findOne({ i: 15 })
  assert.equal(data.i, 15)
  verify(null, [`${STATEMENT_PREFIX}/findOne`], ['findOne'], { strict: false })
})

collectionTest('findOneAndDelete', async function findOneAndDeleteTest(collection, verify) {
  const data = await collection.findOneAndDelete({ i: 15 })
  const response = data?.value?.i ?? data.i
  assert.equal(response, 15)
  verify(null, [`${STATEMENT_PREFIX}/findOneAndDelete`], ['findOneAndDelete'], { strict: false })
})

collectionTest('findOneAndReplace', async function findAndReplaceTest(collection, verify) {
  const data = await collection.findOneAndReplace({ i: 15 }, { b: 15 }, findOpt)
  const response = data?.value?.b ?? data.b
  assert.equal(response, 15)
  verify(null, [`${STATEMENT_PREFIX}/findOneAndReplace`], ['findOneAndReplace'], { strict: false })
})

collectionTest('findOneAndUpdate', async function findOneAndUpdateTest(collection, verify) {
  const data = await collection.findOneAndUpdate({ i: 15 }, { $set: { a: 15 } }, findOpt)
  const response = data?.value?.a ?? data.a
  assert.equal(response, 15)
  verify(null, [`${STATEMENT_PREFIX}/findOneAndUpdate`], ['findOneAndUpdate'], { strict: false })
})
