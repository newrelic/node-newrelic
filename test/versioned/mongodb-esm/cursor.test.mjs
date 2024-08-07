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

test('cursor tests', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('count', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/count`, 'Callback: onCount']
    const metrics = ['count']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.find({}).count(function onCount(error, data) {
        assert.equal(error, undefined, 'should not error')
        assert.equal(data, 30, 'should have correct result')
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('explain', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/explain`, 'Callback: onExplain']
    const metrics = ['explain']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.find({}).explain(function onExplain(error, data) {
        assert.equal(error, undefined, 'should not error')
        assert.equal(
          data.queryPlanner.namespace,
          `${DB_NAME}.${COLLECTIONS.collection1}`,
          'should have correct result'
        )
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('next', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/next`, 'Callback: onNext']
    const metrics = ['next']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.find({}).next(function onNext(error, data) {
        assert.equal(error, undefined, 'should not error')
        assert.equal(data.i, 0, 'should have correct result')
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })

  await t.test('toArray', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/toArray`, 'Callback: onToArray']
    const metrics = ['toArray']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.find({}).toArray(function onToArray(error, data) {
        assert.equal(error, undefined, 'should not error')
        assert.equal(data[0].i, 0, 'should have correct result')
        getValidatorCallback({ t, tx, segments, metrics, end })()
      })
    })
  })
})
