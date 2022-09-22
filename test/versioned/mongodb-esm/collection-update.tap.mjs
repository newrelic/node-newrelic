/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import semver from 'semver'
import tap from 'tap'
import { test } from './collection-common.mjs'
import helper from '../../lib/agent_helper.js'
import { pkgVersion, STATEMENT_PREFIX } from './common.cjs'

/**
 * The response from the methods in this file differ between versions
 * This helper decides which pieces to assert
 *
 * @param {Object} params
 * @param {Tap.Test} params.t
 * @param {Object} params.data result from callback used to assert
 * @param {Number} params.count, optional
 * @param {string} params.keyPrefix prefix where the count exists
 * @param {Object} params.extraValues extra fields to assert on >=4.0.0 version of module
 * @param {Object} params.legaycValues extra fields to assert on <4.0.0 version of module
 */
function assertExpectedResult({ t, data, count, keyPrefix, extraValues, legacyValues }) {
  if (semver.satisfies(pkgVersion, '<4')) {
    const expectedResult = { ok: 1, ...legacyValues }
    if (count) {
      expectedResult.n = count
    }
    t.same(data.result, expectedResult)
  } else {
    const expectedResult = { acknowledged: true, ...extraValues }
    if (count) {
      expectedResult[`${keyPrefix}Count`] = count
    }
    t.same(data, expectedResult)
  }
}

tap.test('Collection(Update) Tests', (t) => {
  t.autoend()
  let agent

  t.before(() => {
    agent = helper.instrumentMockedAgent()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  test({ suiteName: 'deleteMany', agent, t }, function deleteManyTest(t, collection, verify) {
    collection.deleteMany({ mod10: 5 }, function done(err, data) {
      t.error(err)
      assertExpectedResult({
        t,
        data,
        count: 3,
        keyPrefix: 'deleted'
      })
      verify(null, [`${STATEMENT_PREFIX}/deleteMany`, 'Callback: done'], ['deleteMany'])
    })
  })

  test({ suiteName: 'deleteOne', agent, t }, function deleteOneTest(t, collection, verify) {
    collection.deleteOne({ mod10: 5 }, function done(err, data) {
      t.error(err)
      assertExpectedResult({
        t,
        data,
        count: 1,
        keyPrefix: 'deleted'
      })
      verify(null, [`${STATEMENT_PREFIX}/deleteOne`, 'Callback: done'], ['deleteOne'])
    })
  })

  test({ suiteName: 'insert', agent, t }, function insertTest(t, collection, verify) {
    collection.insert({ foo: 'bar' }, function done(err, data) {
      t.error(err)
      assertExpectedResult({
        t,
        data,
        count: 1,
        keyPrefix: 'inserted',
        extraValues: {
          insertedIds: {
            0: {}
          }
        }
      })

      verify(null, [`${STATEMENT_PREFIX}/insert`, 'Callback: done'], ['insert'])
    })
  })

  test({ suiteName: 'insertMany', agent, t }, function insertManyTest(t, collection, verify) {
    collection.insertMany([{ foo: 'bar' }, { foo: 'bar2' }], function done(err, data) {
      t.error(err)
      assertExpectedResult({
        t,
        data,
        count: 2,
        keyPrefix: 'inserted',
        extraValues: {
          insertedIds: {
            0: {},
            1: {}
          }
        }
      })

      verify(null, [`${STATEMENT_PREFIX}/insertMany`, 'Callback: done'], ['insertMany'])
    })
  })

  test({ suiteName: 'insertOne', agent, t }, function insertOneTest(t, collection, verify) {
    collection.insertOne({ foo: 'bar' }, function done(err, data) {
      t.error(err)
      assertExpectedResult({
        t,
        data,
        legacyValues: {
          n: 1
        },
        extraValues: {
          insertedId: {}
        }
      })

      verify(null, [`${STATEMENT_PREFIX}/insertOne`, 'Callback: done'], ['insertOne'])
    })
  })

  test({ suiteName: 'remove', agent, t }, function removeTest(t, collection, verify) {
    collection.remove({ mod10: 5 }, function done(err, data) {
      t.error(err)
      assertExpectedResult({
        t,
        data,
        count: 3,
        keyPrefix: 'deleted'
      })

      verify(null, [`${STATEMENT_PREFIX}/remove`, 'Callback: done'], ['remove'])
    })
  })

  test({ suiteName: 'replaceOne', agent, t }, function replaceOneTest(t, collection, verify) {
    collection.replaceOne({ i: 5 }, { foo: 'bar' }, function done(err, data) {
      t.error(err)
      assertExpectedResult({
        t,
        data,
        count: 1,
        keyPrefix: 'modified',
        legacyValues: {
          nModified: 1
        },
        extraValues: {
          matchedCount: 1,
          upsertedCount: 0,
          upsertedId: null
        }
      })

      verify(null, [`${STATEMENT_PREFIX}/replaceOne`, 'Callback: done'], ['replaceOne'])
    })
  })

  if (semver.satisfies(pkgVersion, '<4')) {
    test({ suiteName: 'save', agent, t }, function saveTest(t, collection, verify) {
      collection.save({ foo: 'bar' }, function done(err, data) {
        t.error(err)
        t.same(data.result, { ok: 1, n: 1 })

        verify(null, [`${STATEMENT_PREFIX}/save`, 'Callback: done'], ['save'])
      })
    })
  }

  test({ suiteName: 'update', agent, t }, function updateTest(t, collection, verify) {
    collection.update({ i: 5 }, { $set: { foo: 'bar' } }, function done(err, data) {
      t.error(err)
      assertExpectedResult({
        t,
        data,
        count: 1,
        keyPrefix: 'modified',
        legacyValues: {
          nModified: 1
        },
        extraValues: {
          matchedCount: 1,
          upsertedCount: 0,
          upsertedId: null
        }
      })

      verify(null, [`${STATEMENT_PREFIX}/update`, 'Callback: done'], ['update'])
    })
  })

  test({ suiteName: 'updateMany', agent, t }, function updateManyTest(t, collection, verify) {
    collection.updateMany({ mod10: 5 }, { $set: { a: 5 } }, function done(err, data) {
      t.error(err)
      assertExpectedResult({
        t,
        data,
        count: 3,
        keyPrefix: 'modified',
        legacyValues: {
          nModified: 3
        },
        extraValues: {
          matchedCount: 3,
          upsertedCount: 0,
          upsertedId: null
        }
      })

      verify(null, [`${STATEMENT_PREFIX}/updateMany`, 'Callback: done'], ['updateMany'])
    })
  })

  test({ suiteName: 'updateOne', agent, t }, function updateOneTest(t, collection, verify) {
    collection.updateOne({ i: 5 }, { $set: { a: 5 } }, function done(err, data) {
      t.notOk(err, 'should not error')
      assertExpectedResult({
        t,
        data,
        count: 1,
        keyPrefix: 'modified',
        legacyValues: {
          nModified: 1
        },
        extraValues: {
          matchedCount: 1,
          upsertedCount: 0,
          upsertedId: null
        }
      })

      verify(null, [`${STATEMENT_PREFIX}/updateOne`, 'Callback: done'], ['updateOne'])
    })
  })
})
