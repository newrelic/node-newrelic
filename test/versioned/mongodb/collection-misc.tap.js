/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const common = require('./collection-common')
const semver = require('semver')
const { pkgVersion, STATEMENT_PREFIX, COLLECTIONS, DB_NAME } = require('./common')

function verifyAggregateData(t, data) {
  t.equal(data.length, 3, 'should have expected amount of results')
  t.same(data, [{ value: 5 }, { value: 15 }, { value: 25 }], 'should have expected results')
}

common.test('aggregate', async function aggregateTest(t, collection, verify) {
  const data = await collection
    .aggregate([
      { $sort: { i: 1 } },
      { $match: { mod10: 5 } },
      { $limit: 3 },
      { $project: { value: '$i', _id: 0 } }
    ])
    .toArray()
  verifyAggregateData(t, data)
  verify(
    null,
    [`${STATEMENT_PREFIX}/aggregate`, `${STATEMENT_PREFIX}/toArray`],
    ['aggregate', 'toArray'],
    { childrenLength: 2 }
  )
})

common.test('bulkWrite', async function bulkWriteTest(t, collection, verify) {
  const data = await collection.bulkWrite(
    [{ deleteMany: { filter: {} } }, { insertOne: { document: { a: 1 } } }],
    { ordered: true, w: 1 }
  )

  t.equal(data.insertedCount, 1)
  t.equal(data.deletedCount, 30)
  verify(null, [`${STATEMENT_PREFIX}/bulkWrite`], ['bulkWrite'], { strict: false })
})

common.test('count', async function countTest(t, collection, verify) {
  const data = await collection.count()
  t.equal(data, 30)
  verify(null, [`${STATEMENT_PREFIX}/count`], ['count'], { strict: false })
})

common.test('distinct', async function distinctTest(t, collection, verify) {
  const data = await collection.distinct('mod10')
  t.same(data.sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  verify(null, [`${STATEMENT_PREFIX}/distinct`], ['distinct'], { strict: false })
})

common.test('drop', async function dropTest(t, collection, verify) {
  const data = await collection.drop()
  t.equal(data, true)
  verify(null, [`${STATEMENT_PREFIX}/drop`], ['drop'], { strict: false })
})

common.test('isCapped', async function isCappedTest(t, collection, verify) {
  const data = await collection.isCapped()
  t.notOk(data)

  verify(null, [`${STATEMENT_PREFIX}/isCapped`], ['isCapped'], { strict: false })
})

common.test('options', async function optionsTest(t, collection, verify) {
  const data = await collection.options()

  // Depending on the version of the mongo server this will change.
  if (data) {
    t.same(data, {}, 'should have expected results')
  } else {
    t.notOk(data, 'should have expected results')
  }

  verify(null, [`${STATEMENT_PREFIX}/options`], ['options'], { strict: false })
})

common.test('rename', async function renameTest(t, collection, verify) {
  await collection.rename(COLLECTIONS.collection2)

  verify(null, [`${STATEMENT_PREFIX}/rename`], ['rename'], { strict: false })
})

if (semver.satisfies(pkgVersion, '<6.0.0')) {
  common.test('stats', async function statsTest(t, collection, verify) {
    const data = await collection.stats({ i: 5 })
    t.equal(data.ns, `${DB_NAME}.${COLLECTIONS.collection1}`)
    t.equal(data.count, 30)
    t.equal(data.ok, 1)

    verify(null, [`${STATEMENT_PREFIX}/stats`], ['stats'], { strict: false })
  })
}

if (semver.satisfies(pkgVersion, '<5.0.0')) {
  common.test('mapReduce', async function mapReduceTest(t, collection, verify) {
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
    t.same(data, expectedData)

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
