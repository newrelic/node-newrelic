/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const common = require('./collection-common')
const { STATEMENT_PREFIX } = require('./common')
const findOpt = { returnDocument: 'after' }

common.test('findOne', async function findOneTest(t, collection, verify) {
  const data = await collection.findOne({ i: 15 })
  t.equal(data.i, 15)
  verify(null, [`${STATEMENT_PREFIX}/findOne`], ['findOne'], { strict: false })
})

common.test('findOneAndDelete', async function findOneAndDeleteTest(t, collection, verify) {
  const data = await collection.findOneAndDelete({ i: 15 })
  const response = data?.value?.i || data.i
  t.equal(response, 15)
  verify(null, [`${STATEMENT_PREFIX}/findOneAndDelete`], ['findOneAndDelete'], { strict: false })
})

common.test('findOneAndReplace', async function findAndReplaceTest(t, collection, verify) {
  const data = await collection.findOneAndReplace({ i: 15 }, { b: 15 }, findOpt)
  const response = data?.value?.b || data.b
  t.equal(response, 15)
  verify(null, [`${STATEMENT_PREFIX}/findOneAndReplace`], ['findOneAndReplace'], { strict: false })
})

common.test('findOneAndUpdate', async function findOneAndUpdateTest(t, collection, verify) {
  const data = await collection.findOneAndUpdate({ i: 15 }, { $set: { a: 15 } }, findOpt)
  const response = data?.value?.a || data.a
  t.equal(response, 15)
  verify(null, [`${STATEMENT_PREFIX}/findOneAndUpdate`], ['findOneAndUpdate'], { strict: false })
})
