/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Accessing `cursor.count` is deprecated in some version of MongoDB that we
// test against. We do not need to see these warnings in our tests. This line
// should be disabled as we drop old versions of MongoDB in order to determine
// if it can be removed.
process.env.NODE_NO_WARNINGS = 1

const assert = require('node:assert')

const common = require('./collection-common')
const { STATEMENT_PREFIX } = require('./common')

common.test('count', async function countTest(collection, verify) {
  const data = await collection.find({}).count()
  assert.equal(data, 30, 'should have correct result')
  verify(null, [`${STATEMENT_PREFIX}/count`], ['count'], { strict: false })
})

common.test('explain', async function explainTest(collection, verify) {
  const data = await collection.find({}).explain()
  assert.ok(data.hasOwnProperty('queryPlanner'), 'should have correct response')
  verify(null, [`${STATEMENT_PREFIX}/explain`], ['explain'], { strict: false })
})

common.test('next', async function nextTest(collection, verify) {
  const data = await collection.find({}).next()
  assert.equal(data.i, 0)
  verify(null, [`${STATEMENT_PREFIX}/next`], ['next'], { strict: false })
})

common.test('toArray', async function toArrayTest(collection, verify) {
  const data = await collection.find({}).toArray()
  assert.equal(data[0].i, 0)
  verify(null, [`${STATEMENT_PREFIX}/toArray`], ['toArray'], { strict: false })
})
