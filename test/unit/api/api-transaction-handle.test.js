/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

test('Agent API - transaction handle', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('exports a function for getting a transaction handle', (t, end) => {
    const { api } = t.nr
    assert.ok(api.getTransaction)
    assert.equal(typeof api.getTransaction, 'function')

    end()
  })

  await t.test('should return a stub when running outside of a transaction', (t, end) => {
    const { api } = t.nr
    const handle = api.getTransaction()
    assert.equal(typeof handle.end, 'function')
    assert.equal(typeof handle.ignore, 'function')

    assert.equal(typeof handle.acceptDistributedTraceHeaders, 'function')
    assert.equal(typeof handle.insertDistributedTraceHeaders, 'function')
    assert.equal(typeof handle.isSampled, 'function')

    end()
  })

  await t.test('should mark the transaction as externally handled', (t, end) => {
    const { api, agent } = t.nr
    helper.runInTransaction(agent, function (txn) {
      const handle = api.getTransaction()

      assert.ok(txn.handledExternally)
      assert.equal(typeof handle.end, 'function')

      handle.end()
      end()
    })
  })

  await t.test('should return a method to ignore the transaction', (t, end) => {
    const { api, agent } = t.nr
    helper.runInTransaction(agent, function (txn) {
      const handle = api.getTransaction()

      assert.equal(typeof handle.ignore, 'function')

      handle.ignore()

      assert.ok(txn.forceIgnore)
      assert.equal(typeof handle.end, 'function')

      handle.end()
      end()
    })
  })

  await t.test('should have a method to insert distributed trace headers', (t, end) => {
    const { api, agent } = t.nr
    helper.runInTransaction(agent, function () {
      const handle = api.getTransaction()

      assert.equal(typeof handle.insertDistributedTraceHeaders, 'function')
      agent.config.cross_process_id = '1234#5678'

      const headers = {}
      handle.insertDistributedTraceHeaders(headers)

      assert.equal(typeof headers.traceparent, 'string')

      end()
    })
  })

  await t.test('should have a method for accepting distributed trace headers', (t, end) => {
    const { api, agent } = t.nr
    helper.runInTransaction(agent, function () {
      const handle = api.getTransaction()
      assert.equal(typeof handle.acceptDistributedTraceHeaders, 'function')
      end()
    })
  })

  await t.test('should return a handle with a method to end the transaction', (t, end) => {
    const { api, agent } = t.nr
    let transaction
    agent.on('transactionFinished', function (finishedTransaction) {
      assert.equal(finishedTransaction.id, transaction.id)
      end()
    })

    helper.runInTransaction(agent, function (txn) {
      transaction = txn
      const handle = api.getTransaction()
      assert.equal(typeof handle.end, 'function')
      handle.end()
    })
  })

  await t.test('should call a callback when handle end is called', (t, end) => {
    const { api, agent } = t.nr
    helper.runInTransaction(agent, function () {
      const handle = api.getTransaction()
      handle.end(function () {
        end()
      })
    })
  })

  await t.test('does not blow up when end is called without a callback', (t, end) => {
    const { api, agent } = t.nr
    helper.runInTransaction(agent, function () {
      const handle = api.getTransaction()
      handle.end()

      end()
    })
  })

  await t.test(
    'should have a method for reporting whether the transaction is sampled',
    (t, end) => {
      const { api, agent } = t.nr
      helper.runInTransaction(agent, function () {
        const handle = api.getTransaction()
        assert.equal(typeof handle.isSampled, 'function')
        assert.equal(handle.isSampled(), true)

        end()
      })
    }
  )
})
