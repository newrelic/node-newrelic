/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'
import helper from '../../lib/agent_helper.js'
import { ESM } from './common.cjs'
import { beforeEach, afterEach } from './test-hooks.mjs'
import { getValidatorCallback, matchObject } from './test-assertions.mjs'
import common from '../mongodb/common.js'

const { STATEMENT_PREFIX } = ESM

/**
 * The response from the methods in this file differ between versions
 * This helper decides which pieces to assert
 *
 * @param {Object} params
 * @param {Object} params.data result from callback used to assert
 * @param {Number} params.count, optional
 * @param {string} params.keyPrefix prefix where the count exists
 * @param {Object} params.extraValues extra fields to assert on >=4.0.0 version of module
 */
function assertExpectedResult({ data, count, keyPrefix, extraValues }) {
  const expectedResult = { acknowledged: true, ...extraValues }
  if (count) {
    expectedResult[`${keyPrefix}Count`] = count
  }
  matchObject(data, expectedResult)
}

test('collection update tests', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('deleteMany', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/deleteMany`, 'Callback: done']
    const metrics = ['deleteMany']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.deleteMany({ mod10: 5 }, function done(error, data) {
        assert.equal(error, undefined)
        assertExpectedResult({ data, count: 3, keyPrefix: 'deleted' })
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('deleteOne', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/deleteOne`, 'Callback: done']
    const metrics = ['deleteOne']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.deleteOne({ mod10: 5 }, function done(error, data) {
        assert.equal(error, undefined)
        assertExpectedResult({ data, count: 1, keyPrefix: 'deleted' })
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('insert', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/insert`, 'Callback: done']
    const metrics = ['insert']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.insert({ foo: 'bar' }, function done(error, data) {
        assert.equal(error, undefined)
        assertExpectedResult({
          data,
          count: 1,
          keyPrefix: 'inserted',
          extraValues: { insertedIds: { 0: {} } }
        })
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('insertMany', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/insertMany`, 'Callback: done']
    const metrics = ['insertMany']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.insertMany([{ foo: 'bar' }, { foo: 'bar2' }], function done(error, data) {
        assert.equal(error, undefined)
        assertExpectedResult({
          data,
          count: 2,
          keyPrefix: 'inserted',
          extraValues: { insertedIds: { 0: {}, 1: {} } }
        })
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('insertOne', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/insertOne`, 'Callback: done']
    const metrics = ['insertOne']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.insertOne({ foo: 'bar' }, function done(error, data) {
        assert.equal(error, undefined)
        assertExpectedResult({
          data,
          keyPrefix: 'inserted',
          extraValues: { insertedId: {} }
        })
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('remove', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/remove`, 'Callback: done']
    const metrics = ['remove']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.remove({ mod10: 5 }, function done(error, data) {
        assert.equal(error, undefined)
        assertExpectedResult({
          data,
          count: 3,
          keyPrefix: 'deleted'
        })
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('replaceOne', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/replaceOne`, 'Callback: done']
    const metrics = ['replaceOne']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.replaceOne({ i: 5 }, { foo: 'bar' }, function done(error, data) {
        assert.equal(error, undefined)
        assertExpectedResult({
          data,
          count: 1,
          keyPrefix: 'modified',
          extraValues: { matchedCount: 1, upsertedCount: 0, upsertedId: null }
        })
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('update', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/update`, 'Callback: done']
    const metrics = ['update']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.update({ i: 5 }, { $set: { foo: 'bar' } }, function done(error, data) {
        assert.equal(error, undefined)
        assertExpectedResult({
          data,
          count: 1,
          keyPrefix: 'modified',
          extraValues: { matchedCount: 1, upsertedCount: 0, upsertedId: null }
        })
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('updateMany', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/updateMany`, 'Callback: done']
    const metrics = ['updateMany']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.updateMany({ mod10: 5 }, { $set: { a: 5 } }, function done(error, data) {
        assert.equal(error, undefined)
        assertExpectedResult({
          data,
          count: 3,
          keyPrefix: 'modified',
          extraValues: { matchedCount: 3, upsertedCount: 0, upsertedId: null }
        })
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('updateOne', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/updateOne`, 'Callback: done']
    const metrics = ['updateOne']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.updateOne({ i: 5 }, { $set: { a: 5 } }, function done(error, data) {
        assert.equal(error, undefined)
        assertExpectedResult({
          data,
          count: 1,
          keyPrefix: 'modified',
          extraValues: { matchedCount: 1, upsertedCount: 0, upsertedId: null }
        })
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })
})
