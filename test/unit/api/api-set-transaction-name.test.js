/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')
const TEST_URL = '/test/path/31337'
const NAME = 'WebTransaction/Uri/test/path/31337'

test('Agent API - setTransactionName', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('exports a transaction naming function', (t, end) => {
    const { api } = t.nr
    assert.ok(api.setTransactionName)
    assert.equal(typeof api.setTransactionName, 'function')

    end()
  })

  await t.test('sets the transaction name to the custom name', async (t) => {
    const { agent, api } = t.nr
    const { transaction } = await setTranasactionNameGoldenPath({ agent, api })
    assert.equal(transaction.name, 'WebTransaction/Custom/Test')
  })

  await t.test('names the web trace segment after the custom name', async (t) => {
    const { agent, api } = t.nr
    const { segment } = await setTranasactionNameGoldenPath({ agent, api })
    assert.equal(segment.name, 'WebTransaction/Custom/Test')
  })

  await t.test('leaves the request URL alone', async (t) => {
    const { agent, api } = t.nr
    const { transaction } = await setTranasactionNameGoldenPath({ agent, api })
    assert.equal(transaction.url, TEST_URL)
  })

  await t.test('uses the last name set when called multiple times', (t, end) => {
    const { agent, api } = t.nr
    agent.on('transactionFinished', function (transaction) {
      transaction.finalizeNameFromUri(TEST_URL, 200)

      assert.equal(transaction.name, 'WebTransaction/Custom/List')

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      agent.tracer.createSegment(NAME)
      transaction.url = TEST_URL
      transaction.verb = 'GET'

      // NAME THE CONTROLLER AND ACTION, MULTIPLE TIMES
      api.setTransactionName('Index')
      api.setTransactionName('Update')
      api.setTransactionName('Delete')
      api.setTransactionName('List')

      transaction.end()
    })
  })
})

function setTranasactionNameGoldenPath({ agent, api }) {
  let segment = null
  return new Promise((resolve) => {
    agent.on('transactionFinished', function (finishedTransaction) {
      finishedTransaction.finalizeNameFromUri(TEST_URL, 200)
      segment.markAsWeb(finishedTransaction)
      resolve({ transaction: finishedTransaction, segment })
    })

    helper.runInTransaction(agent, function (tx) {
      // grab segment
      agent.tracer.addSegment(NAME, null, null, false, function () {
        // HTTP instrumentation sets URL as soon as it knows it
        segment = agent.tracer.getSegment()
        tx.type = 'web'
        tx.url = TEST_URL
        tx.verb = 'POST'

        // Name the transaction
        api.setTransactionName('Test')

        tx.end()
      })
    })
  })
}
