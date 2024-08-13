/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'
import helper from '../../lib/agent_helper.js'
import { ESM } from './common.cjs'
import { beforeEach, afterEach } from './test-hooks.mjs'
import { getValidatorCallback } from './test-assertions.mjs'
import common from '../mongodb/common.js'

const { DB_NAME, COLLECTIONS, STATEMENT_PREFIX } = ESM

test('collection misc tests', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('aggregate v4', { skip: true }, (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/aggregate`, `${STATEMENT_PREFIX}/toArray`]
    const metrics = ['aggregate', 'toArray']

    helper.runInTransaction(agent, async (tx) => {
      tx.name = common.TRANSACTION_NAME
      const data = await collection
        .aggregate([
          { $sort: { i: 1 } },
          { $match: { mod10: 5 } },
          { $limit: 3 },
          { $project: { value: '$i', _id: 0 } }
        ])
        .toArray()
      assert.equal(data.length, 3, 'should have expected amount of results')
      assert.deepStrictEqual(
        data,
        [{ value: 5 }, { value: 15 }, { value: 25 }],
        'should have expected results'
      )
      getValidatorCallback({ t, tx, segments, metrics, childrenLength: 2, end })()
    })
  })

  await t.test('bulkWrite', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/bulkWrite`, 'Callback: onWrite']
    const metrics = ['bulkWrite']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.bulkWrite(
        [{ deleteMany: { filter: {} } }, { insertOne: { document: { a: 1 } } }],
        { ordered: true, w: 1 },
        onWrite
      )

      function onWrite(error, data) {
        assert.equal(error, undefined)
        assert.equal(data.insertedCount, 1)
        assert.equal(data.deletedCount, 30)
        getValidatorCallback({ t, tx, segments, metrics, end })()
      }
    })
  })

  await t.test('count', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/count`, 'Callback: onCount']
    const metrics = ['count']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.count(function onCount(error, data) {
        assert.equal(error, undefined)
        assert.equal(data, 30)
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('distinct', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/distinct`, 'Callback: done']
    const metrics = ['distinct']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.distinct('mod10', function done(error, data) {
        assert.equal(error, undefined)
        assert.deepStrictEqual(data.sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('drop', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/drop`, 'Callback: done']
    const metrics = ['drop']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.drop(function done(error, data) {
        assert.equal(error, undefined)
        assert.equal(data, true)
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('isCapped', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/isCapped`, 'Callback: done']
    const metrics = ['isCapped']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.isCapped(function done(error, data) {
        assert.equal(error, undefined)
        assert.equal(data, false)
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('mapReduce', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/mapReduce`, 'Callback: done']
    const metrics = ['mapReduce']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.mapReduce(map, reduce, { out: { inline: 1 } }, done)

      function done(error, data) {
        assert.equal(error, undefined)
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

        getValidatorCallback({ t, tx, segments, metrics, end })()
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
  })

  await t.test('options', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/options`, 'Callback: done']
    const metrics = ['options']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.options(function done(error, data) {
        assert.equal(error, undefined)
        assert.deepStrictEqual(data, {}, 'should have expected results')
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('rename', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/rename`, 'Callback: done']
    const metrics = ['rename']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.rename(COLLECTIONS.collection2, function done(error) {
        assert.equal(error, undefined)
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('stats', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/stats`, 'Callback: done']
    const metrics = ['stats']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.stats({ i: 5 }, function done(error, data) {
        assert.equal(error, undefined)
        assert.equal(data.ns, `${DB_NAME}.${COLLECTIONS.collection1}`)
        assert.equal(data.count, 30)
        assert.equal(data.ok, 1)
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })
})
