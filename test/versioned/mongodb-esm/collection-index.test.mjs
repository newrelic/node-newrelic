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

const { STATEMENT_PREFIX } = ESM

test('collection index tests', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('createIndex', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/createIndex`, 'Callback: onIndex']
    const metrics = ['createIndex']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.createIndex('i', function onIndex(error, data) {
        assert.equal(error, undefined)
        assert.equal(data, 'i_1')
        getValidatorCallback({ t, tx, metrics, segments, end })()
      })
    })
  })

  await t.test('dropIndex', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [
      `${STATEMENT_PREFIX}/createIndex`,
      'Callback: onIndex',
      `${STATEMENT_PREFIX}/dropIndex`,
      'Callback: done'
    ]
    const metrics = ['createIndex', 'dropIndex']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.createIndex('i', function onIndex(error) {
        assert.equal(error, undefined)
        collection.dropIndex('i_1', function done(erorr, data) {
          assert.equal(error, undefined)
          assert.equal(data.ok, 1)
          getValidatorCallback({ t, tx, metrics, segments, end })()
        })
      })
    })
  })

  await t.test('indexes', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/indexes`, 'Callback: done']
    const metrics = ['indexes']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.indexes('i', function done(error, data) {
        assert.equal(error, undefined)
        const result = data?.[0]
        const expectedResult = {
          v: result?.v,
          key: { _id: 1 },
          name: '_id_'
        }
        assert.deepStrictEqual(result, expectedResult, 'should have expected results')
        getValidatorCallback({ t, tx, metrics, segments, end })()
      })
    })
  })

  await t.test('indexExists', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/indexExists`, 'Callback: done']
    const metrics = ['indexExists']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.indexExists(['_id_'], function done(error, data) {
        assert.equal(error, undefined)
        assert.equal(data, true)
        getValidatorCallback({ t, tx, metrics, segments, end })()
      })
    })
  })

  await t.test('indexInformation', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/indexInformation`, 'Callback: done']
    const metrics = ['indexInformation']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.indexInformation(function done(error, data) {
        assert.equal(error, undefined)
        assert.deepStrictEqual(data._id_, [['_id', 1]], 'should have expected results')
        getValidatorCallback({ t, tx, metrics, segments, end })()
      })
    })
  })
})
