/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'
import helper from '../../lib/agent_helper.js'
import common from '../mongodb/common.js'
import { beforeEach, afterEach } from './test-hooks.mjs'
import { getValidatorCallback } from './test-assertions.mjs'

const {
  ESM: { STATEMENT_PREFIX }
} = common

test('unordered bulk operations', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('should generate the correct metrics and segments', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/unorderedBulk/batch`, 'Callback: done']
    const metrics = ['unorderedBulk']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      const bulk = collection.initializeUnorderedBulkOp()
      bulk.find({ i: 1 }).updateOne({ $set: { foo: 'bar' } })
      bulk.find({ i: 2 }).updateOne({ $set: { foo: 'bar' } })
      bulk.execute(getValidatorCallback({ t, tx, metrics, segments, end }))
    })
  })

  await t.test('should not error outside of a transaction', (t, end) => {
    const { agent, collection } = t.nr
    assert.equal(agent.getTransaction(), undefined, 'should not be in a transaction')
    const bulk = collection.initializeUnorderedBulkOp()
    bulk.find({ i: 1 }).updateOne({ $set: { foo: 'bar' } })
    bulk.find({ i: 2 }).updateOne({ $set: { foo: 'bar' } })
    bulk.execute(function done(error) {
      assert.equal(error, undefined, 'running test should not error')
      assert.equal(agent.getTransaction(), undefined, 'should not somehow gain a transaction')
      end()
    })
  })
})

test('ordered bulk operations', async (t) => {
  t.beforeEach(beforeEach)
  t.afterEach(afterEach)

  await t.test('should generate the correct metrics and segments', (t, end) => {
    const { agent, collection } = t.nr
    const segments = [`${STATEMENT_PREFIX}/orderedBulk/batch`, 'Callback: done']
    const metrics = ['orderedBulk']

    helper.runInTransaction(agent, (tx) => {
      tx.name = common.TRANSACTION_NAME
      const bulk = collection.initializeOrderedBulkOp()
      bulk.find({ i: 1 }).updateOne({ $set: { foo: 'bar' } })
      bulk.find({ i: 2 }).updateOne({ $set: { foo: 'bar' } })
      bulk.execute(getValidatorCallback({ t, tx, metrics, segments, end }))
    })
  })

  await t.test('should not error outside of a transaction', (t, end) => {
    const { agent, collection } = t.nr
    assert.equal(agent.getTransaction(), undefined, 'should not be in a transaction')
    const bulk = collection.initializeOrderedBulkOp()
    bulk.find({ i: 1 }).updateOne({ $set: { foo: 'bar' } })
    bulk.find({ i: 2 }).updateOne({ $set: { foo: 'bar' } })
    bulk.execute(function done(error) {
      assert.equal(error, undefined, 'running test should not error')
      assert.equal(agent.getTransaction(), undefined, 'should not somehow gain a transaction')
      end()
    })
  })
})
