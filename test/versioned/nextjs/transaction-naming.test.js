/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helpers = require('./helpers')
const agentHelper = require('../../lib/agent_helper')
const NEXT_TRANSACTION_PREFIX = 'WebTransaction/WebFrameworkUri/Nextjs/GET/'

test('Next.js', async (t) => {
  await helpers.build(__dirname)
  const agent = agentHelper.instrumentMockedAgent({
    attributes: {
      include: ['request.parameters.*']
    }
  })

  // TODO: would be nice to run a new server per test so there are not chained failures
  // but currently has issues. Potentially due to module caching.
  const server = await helpers.start(__dirname)

  t.after(async () => {
    await server.close()
    agentHelper.unloadAgent(agent)
  })

  await t.test('should properly name static, non-dynamic route, page', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })
    const res = await helpers.makeRequest('/static/standard')
    assert.equal(res.statusCode, 200)
    const [tx] = await txPromise

    assert.ok(tx)
    assert.equal(tx.name, `${NEXT_TRANSACTION_PREFIX}/static/standard`)
  })

  await t.test('should properly name static, dynamic route, page', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })
    const res = await helpers.makeRequest('/static/dynamic/testing')
    assert.equal(res.statusCode, 200)
    const [tx] = await txPromise

    assert.ok(tx)
    assert.equal(tx.name, `${NEXT_TRANSACTION_PREFIX}/static/dynamic/[value]`)
  })

  await t.test('should properly name server-side rendered, non-dynamic route, page', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const res = await helpers.makeRequest('/ssr/people')
    assert.equal(res.statusCode, 200)
    const [tx] = await txPromise

    assert.ok(tx)
    assert.equal(tx.name, `${NEXT_TRANSACTION_PREFIX}/ssr/people`)
  })

  await t.test('should properly name server-side rendered, dynamic route, page', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const res = await helpers.makeRequest('/ssr/dynamic/person/1')
    assert.equal(res.statusCode, 200)
    const [tx] = await txPromise

    assert.ok(tx)
    assert.equal(tx.name, `${NEXT_TRANSACTION_PREFIX}/ssr/dynamic/person/[id]`)
  })

  await t.test('should properly name API with non-dynamic route', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const res = await helpers.makeRequest('/api/hello')
    assert.equal(res.statusCode, 200)
    const [tx] = await txPromise

    assert.ok(tx)
    assert.equal(tx.name, `${NEXT_TRANSACTION_PREFIX}/api/hello`)
  })

  await t.test('should properly name API with dynamic route', async (t) => {
    const txPromise = helpers.setupTransactionHandler({ t, agent })

    const res = await helpers.makeRequest('/api/person/2')
    assert.equal(res.statusCode, 200)
    const [tx] = await txPromise

    assert.ok(tx)
    assert.equal(tx.name, `${NEXT_TRANSACTION_PREFIX}/api/person/[id]`)
  })

  await t.test(
    'should properly name transactions with server-side rendered calling API',
    async (t) => {
      const txPromise = helpers.setupTransactionHandler({ t, agent, expectedCount: 2 })
      const res = await helpers.makeRequest('/person/2')
      assert.equal(res.statusCode, 200)
      const transactions = await txPromise
      assert.equal(transactions.length, 2)
      const apiTransaction = transactions.find((transaction) => {
        return transaction.name === `${NEXT_TRANSACTION_PREFIX}/api/person/[id]`
      })

      const pageTransaction = transactions.find((transaction) => {
        return transaction.name === `${NEXT_TRANSACTION_PREFIX}/person/[id]`
      })

      assert.ok(apiTransaction, 'should find transaction matching person API call')
      assert.ok(pageTransaction, 'should find transaction matching person page call')
    }
  )
})
