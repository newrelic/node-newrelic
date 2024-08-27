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

test('Agent API - setControllerName', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent()
    ctx.nr.api = new API(agent)
    ctx.nr.agent = agent
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('exports a controller naming function', (t, end) => {
    const { api } = t.nr
    assert.ok(api.setControllerName)
    assert.equal(typeof api.setControllerName, 'function')

    end()
  })

  await t.test('sets the controller in the transaction name', async (t) => {
    const { agent, api } = t.nr
    const { transaction } = await goldenPathRenameControllerInTransaction({ agent, api })
    assert.equal(transaction.name, 'WebTransaction/Controller/Test/POST')
  })

  await t.test('names the web trace segment after the controller', async (t) => {
    const { agent, api } = t.nr
    const { segment } = await goldenPathRenameControllerInTransaction({ agent, api })
    assert.equal(segment.name, 'WebTransaction/Controller/Test/POST')
  })

  await t.test('leaves the request URL alone', async (t) => {
    const { agent, api } = t.nr
    const { transaction } = await goldenPathRenameControllerInTransaction({ agent, api })
    assert.equal(transaction.url, TEST_URL)
  })

  await t.test('uses the HTTP verb for the default action', (t, end) => {
    const { agent, api } = t.nr
    agent.on('transactionFinished', function (transaction) {
      transaction.finalizeNameFromUri(TEST_URL, 200)
      assert.equal(transaction.name, 'WebTransaction/Controller/Test/DELETE')

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      agent.tracer.createSegment(NAME)
      transaction.url = TEST_URL

      // SET THE ACTION
      transaction.verb = 'DELETE'

      // NAME THE CONTROLLER
      api.setControllerName('Test')

      transaction.end()
    })
  })

  await t.test('allows a custom action', (t, end) => {
    const { agent, api } = t.nr
    agent.on('transactionFinished', function (transaction) {
      transaction.finalizeNameFromUri(TEST_URL, 200)

      assert.equal(transaction.name, 'WebTransaction/Controller/Test/index')

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      agent.tracer.createSegment(NAME)
      transaction.url = TEST_URL
      transaction.verb = 'GET'

      // NAME THE CONTROLLER AND ACTION
      api.setControllerName('Test', 'index')

      transaction.end()
    })
  })

  await t.test('uses the last controller set when called multiple times', (t, end) => {
    const { agent, api } = t.nr
    agent.on('transactionFinished', function (transaction) {
      transaction.finalizeNameFromUri(TEST_URL, 200)

      assert.equal(transaction.name, 'WebTransaction/Controller/Test/list')

      end()
    })

    helper.runInTransaction(agent, function (transaction) {
      agent.tracer.createSegment(NAME)
      transaction.url = TEST_URL
      transaction.verb = 'GET'

      // NAME THE CONTROLLER AND ACTION, MULTIPLE TIMES
      api.setControllerName('Test', 'index')
      api.setControllerName('Test', 'update')
      api.setControllerName('Test', 'delete')
      api.setControllerName('Test', 'list')

      transaction.end()
    })
  })
})

function goldenPathRenameControllerInTransaction({ agent, api }) {
  let segment = null
  return new Promise((resolve) => {
    agent.on('transactionFinished', function (finishedTransaction) {
      finishedTransaction.finalizeNameFromUri(TEST_URL, 200)
      segment.markAsWeb(TEST_URL)

      resolve({ transaction: finishedTransaction, segment })
    })

    helper.runInTransaction(agent, function (tx) {
      // grab segment
      agent.tracer.addSegment(NAME, null, null, false, function () {
        // HTTP instrumentation sets URL as soon as it knows it
        segment = agent.tracer.getSegment()
        tx.url = TEST_URL
        tx.verb = 'POST'

        // NAME THE CONTROLLER
        api.setControllerName('Test')

        tx.end()
      })
    })
  })
}
