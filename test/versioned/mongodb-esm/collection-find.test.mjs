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
const findOpt = { returnDocument: 'after' }

test('collection find tests', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('findOne', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/findOne`, 'Callback: done']
    const metrics = ['findOne']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.findOne({ i: 15 }, function done(error, data) {
        assert.equal(error, undefined)
        assert.equal(data.i, 15)
        getValidatorCallback({ t, tx, metrics, segments, end })()
      })
    })
  })

  await t.test('findOneAndDelete', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/findOneAndDelete`, 'Callback: done']
    const metrics = ['findOneAndDelete']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.findOneAndDelete({ i: 15 }, function done(error, data) {
        assert.equal(error, undefined)
        assert.equal(data.ok, 1)
        assert.equal(data.value.i, 15)
        getValidatorCallback({ t, tx, metrics, segments, end })()
      })
    })
  })

  await t.test('findOneAndReplace', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/findOneAndReplace`, 'Callback: done']
    const metrics = ['findOneAndReplace']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.findOneAndReplace({ i: 15 }, { b: 15 }, findOpt, function done(error, data) {
        assert.equal(error, undefined)
        assert.equal(data.ok, 1)
        assert.equal(data.value.b, 15)
        getValidatorCallback({ t, tx, metrics, segments, end })()
      })
    })
  })

  await t.test('findOneAndUpdate', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/findOneAndUpdate`, 'Callback: done']
    const metrics = ['findOneAndUpdate']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      collection.findOneAndUpdate(
        { i: 15 },
        { $set: { a: 15 } },
        findOpt,
        function done(error, data) {
          assert.equal(error, undefined)
          assert.equal(data.ok, 1)
          assert.equal(data.value.a, 15)
          getValidatorCallback({ t, tx, metrics, segments, end })()
        }
      )
    })
  })
})
