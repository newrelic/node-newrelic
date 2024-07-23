/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import { test, DB_NAME } from './collection-common.mjs'
import helper from '../../lib/agent_helper.js'
import { STATEMENT_PREFIX, COLLECTIONS } from './common.cjs'

function verifyAggregateData(t, data) {
  t.equal(data.length, 3, 'should have expected amount of results')
  t.same(data, [{ value: 5 }, { value: 15 }, { value: 25 }], 'should have expected results')
}

tap.test('Collection(Index) Tests', (t) => {
  t.autoend()
  let agent

  t.before(() => {
    agent = helper.instrumentMockedAgent()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  test(
    { suiteName: 'aggregate v4', agent, t },
    async function aggregateTest(t, collection, verify) {
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
    }
  )

  test({ suiteName: 'bulkWrite', agent, t }, function bulkWriteTest(t, collection, verify) {
    collection.bulkWrite(
      [{ deleteMany: { filter: {} } }, { insertOne: { document: { a: 1 } } }],
      { ordered: true, w: 1 },
      onWrite
    )

    function onWrite(err, data) {
      t.error(err)
      t.equal(data.insertedCount, 1)
      t.equal(data.deletedCount, 30)
      verify(null, [`${STATEMENT_PREFIX}/bulkWrite`, 'Callback: onWrite'], ['bulkWrite'])
    }
  })

  test({ suiteName: 'count', agent, t }, function countTest(t, collection, verify) {
    collection.count(function onCount(err, data) {
      t.error(err)
      t.equal(data, 30)
      verify(null, [`${STATEMENT_PREFIX}/count`, 'Callback: onCount'], ['count'])
    })
  })

  test({ suiteName: 'distinct', agent, t }, function distinctTest(t, collection, verify) {
    collection.distinct('mod10', function done(err, data) {
      t.error(err)
      t.same(data.sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
      verify(null, [`${STATEMENT_PREFIX}/distinct`, 'Callback: done'], ['distinct'])
    })
  })

  test({ suiteName: 'drop', agent, t }, function dropTest(t, collection, verify) {
    collection.drop(function done(err, data) {
      t.error(err)
      t.equal(data, true)
      verify(null, [`${STATEMENT_PREFIX}/drop`, 'Callback: done'], ['drop'])
    })
  })

  test({ suiteName: 'isCapped', agent, t }, function isCappedTest(t, collection, verify) {
    collection.isCapped(function done(err, data) {
      t.error(err)
      t.notOk(data)

      verify(null, [`${STATEMENT_PREFIX}/isCapped`, 'Callback: done'], ['isCapped'])
    })
  })

  test({ suiteName: 'mapReduce', agent, t }, function mapReduceTest(t, collection, verify) {
    collection.mapReduce(map, reduce, { out: { inline: 1 } }, done)

    function done(err, data) {
      t.error(err)
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

      verify(null, [`${STATEMENT_PREFIX}/mapReduce`, 'Callback: done'], ['mapReduce'])
    }

    /* eslint-disable */
    function map(obj) {
      emit(this.mod10, this.i)
    }
    /* eslint-enable */

    function reduce(key, vals) {
      return vals.reduce(function sum(prev, val) {
        return prev + val
      }, 0)
    }
  })

  test({ suiteName: 'options', agent, t }, function optionsTest(t, collection, verify) {
    collection.options(function done(err, data) {
      t.error(err)

      // Depending on the version of the mongo server this will change.
      if (data) {
        t.same(data, {}, 'should have expected results')
      } else {
        t.notOk(data, 'should have expected results')
      }

      verify(null, [`${STATEMENT_PREFIX}/options`, 'Callback: done'], ['options'])
    })
  })

  test({ suiteName: 'rename', agent, t }, function renameTest(t, collection, verify) {
    collection.rename(COLLECTIONS.collection2, function done(err) {
      t.error(err)

      verify(null, [`${STATEMENT_PREFIX}/rename`, 'Callback: done'], ['rename'])
    })
  })

  test({ suiteName: 'stats', agent, t }, function statsTest(t, collection, verify) {
    collection.stats({ i: 5 }, function done(err, data) {
      t.error(err)
      t.equal(data.ns, `${DB_NAME}.${COLLECTIONS.collection1}`)
      t.equal(data.count, 30)
      t.equal(data.ok, 1)

      verify(null, [`${STATEMENT_PREFIX}/stats`, 'Callback: done'], ['stats'])
    })
  })
})
