/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')

const common = require('./collection-common')
const semver = require('semver')
const { STATEMENT_PREFIX, COLLECTIONS, DB_NAME } = require('./common')

function verifyAggregateData(data) {
  assert.equal(data.length, 3, 'should have expected amount of results')
  assert.deepStrictEqual(
    data,
    [{ value: 5 }, { value: 15 }, { value: 25 }],
    'should have expected results'
  )
}

common.test('aggregate', async function aggregateTest(collection, verify) {
  const data = await collection
    .aggregate([
      { $sort: { i: 1 } },
      { $match: { mod10: 5 } },
      { $limit: 3 },
      { $project: { value: '$i', _id: 0 } }
    ])
    .toArray()
  verifyAggregateData(data)
  verify(
    null,
    [`${STATEMENT_PREFIX}/aggregate`, `${STATEMENT_PREFIX}/toArray`],
    ['aggregate', 'toArray'],
    { childrenLength: 2 }
  )
})

common.test('bulkWrite', async function bulkWriteTest(collection, verify) {
  const data = await collection.bulkWrite(
    [{ deleteMany: { filter: {} } }, { insertOne: { document: { a: 1 } } }],
    { ordered: true, w: 1 }
  )

  assert.equal(data.insertedCount, 1)
  assert.equal(data.deletedCount, 30)
  verify(null, [`${STATEMENT_PREFIX}/bulkWrite`], ['bulkWrite'], { strict: false })
})

common.test('count', async function countTest(collection, verify) {
  const data = await collection.count()
  assert.equal(data, 30)
  verify(null, [`${STATEMENT_PREFIX}/count`], ['count'], { strict: false })
})

common.test('distinct', async function distinctTest(collection, verify) {
  const data = await collection.distinct('mod10')
  assert.deepStrictEqual(data.sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  verify(null, [`${STATEMENT_PREFIX}/distinct`], ['distinct'], { strict: false })
})

common.test('drop', async function dropTest(collection, verify) {
  const data = await collection.drop()
  assert.equal(data, true)
  verify(null, [`${STATEMENT_PREFIX}/drop`], ['drop'], { strict: false })
})

common.test('isCapped', async function isCappedTest(collection, verify) {
  const data = await collection.isCapped()
  assert.equal(data, false)

  verify(null, [`${STATEMENT_PREFIX}/isCapped`], ['isCapped'], { strict: false })
})

common.test('options', async function optionsTest(collection, verify) {
  const data = await collection.options()

  // Depending on the version of the mongo server this will change.
  if (data) {
    assert.deepStrictEqual(data, {}, 'should have expected results')
  } else {
    assert.equal(data, false, 'should have expected results')
  }

  verify(null, [`${STATEMENT_PREFIX}/options`], ['options'], { strict: false })
})

common.test('rename', async function renameTest(collection, verify) {
  await collection.rename(COLLECTIONS.collection2)

  verify(null, [`${STATEMENT_PREFIX}/rename`], ['rename'], { strict: false })
})

if (semver.satisfies(common.pkgVersion, '<6.0.0')) {
  common.test('stats', async function statsTest(collection, verify) {
    const data = await collection.stats({ i: 5 })
    assert.equal(data.ns, `${DB_NAME}.${COLLECTIONS.collection1}`)
    assert.equal(data.count, 30)
    assert.equal(data.ok, 1)

    verify(null, [`${STATEMENT_PREFIX}/stats`], ['stats'], { strict: false })
  })
}

if (semver.satisfies(common.pkgVersion, '<5.0.0')) {
  common.test('mapReduce', async function mapReduceTest(collection, verify) {
    const data = await collection.mapReduce(map, reduce, { out: { inline: 1 } })

    const expectedData = [
      { _id: 0, value: 30 },
      { _id: 1, value: 33 },
      { _id: 2, value: 36 },
      { _id: 3, value: 39 },
      { _id: 4, value: 42 },
      { _id: 5, value: 45 },
      { _id: 6, value: 48 },
      { _id: 7, value: 51 },
      { _id: 8, value: 54 },
      { _id: 9, value: 57 }
    ]

    // data is not sorted depending on speed of
    // db calls, sort to compare vs expected collection
    data.sort((a, b) => a._id - b._id)
    assert.deepStrictEqual(data, expectedData)

    verify(null, [`${STATEMENT_PREFIX}/mapReduce`], ['mapReduce'], { strict: false })

    /* eslint-disable */
    function map() {
      emit(this.mod10, this.i)
    }
    /* eslint-enable */

    function reduce(_key, vals) {
      return vals.reduce(function sum(prev, val) {
        return prev + val
      }, 0)
    }
  })
}
