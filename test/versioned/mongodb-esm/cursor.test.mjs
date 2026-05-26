/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// Accessing `cursor.count` is deprecated in some versions of MongoDB.
process.env.NODE_NO_WARNINGS = 1

import assert from 'node:assert'

import { collectionTest } from './collection-common.mjs'
import common from '../mongodb/common.js'

const { STATEMENT_PREFIX } = common.ESM

collectionTest('count', async function countTest(collection, verify) {
  const data = await collection.find({}).count()
  assert.equal(data, 30, 'should have correct result')
  verify(null, [`${STATEMENT_PREFIX}/count`], ['count'], { strict: false })
})

collectionTest('explain', async function explainTest(collection, verify) {
  const data = await collection.find({}).explain()
  assert.ok(
    Object.prototype.hasOwnProperty.call(data, 'queryPlanner'),
    'should have correct response'
  )
  verify(null, [`${STATEMENT_PREFIX}/explain`], ['explain'], { strict: false })
})

collectionTest('next', async function nextTest(collection, verify) {
  const data = await collection.find({}).next()
  assert.equal(data.i, 0)
  verify(null, [`${STATEMENT_PREFIX}/next`], ['next'], { strict: false })
})

collectionTest('toArray', async function toArrayTest(collection, verify) {
  const data = await collection.find({}).toArray()
  assert.equal(data[0].i, 0)
  verify(null, [`${STATEMENT_PREFIX}/toArray`], ['toArray'], { strict: false })
})
