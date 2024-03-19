/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('./collection-common')
const { STATEMENT_PREFIX } = require('./common')

common.test('count', async function countTest(t, collection, verify) {
  const data = await collection.find({}).count()
  t.equal(data, 30, 'should have correct result')
  verify(null, [`${STATEMENT_PREFIX}/count`], ['count'], { strict: false })
})

common.test('explain', async function explainTest(t, collection, verify) {
  const data = await collection.find({}).explain()
  t.ok(data.hasOwnProperty('queryPlanner'), 'should have correct response')
  verify(null, [`${STATEMENT_PREFIX}/explain`], ['explain'], { strict: false })
})

common.test('next', async function nextTest(t, collection, verify) {
  const data = await collection.find({}).next()
  t.equal(data.i, 0)
  verify(null, [`${STATEMENT_PREFIX}/next`], ['next'], { strict: false })
})

common.test('toArray', async function toArrayTest(t, collection, verify) {
  const data = await collection.find({}).toArray()
  t.equal(data[0].i, 0)
  verify(null, [`${STATEMENT_PREFIX}/toArray`], ['toArray'], { strict: false })
})
