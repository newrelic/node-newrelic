/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helpers = require('./helpers')
const utils = require('@newrelic/test-utilities')

const NEXT_TRANSACTION_PREFIX = 'WebTransaction/WebFrameworkUri/Nextjs/GET/'

tap.test('Next.js', (t) => {
  t.autoend()
  let agent
  let app

  t.before(async () => {
    await helpers.build()

    agent = utils.TestAgent.makeInstrumented({
      attributes: {
        include: ['request.parameters.*']
      }
    })
    helpers.registerInstrumentation(agent)

    // TODO: would be nice to run a new server per test so there are not chained failures
    // but currently has issues. Potentially due to module caching.
    app = await helpers.start()
  })

  t.teardown(() => {
    app.options.httpServer.close()
    agent.unload()
  })

  t.test('should properly name static, non-dynamic route, page', async (t) => {
    let endedTransaction = null
    agent.agent.on('transactionFinished', (transaction) => {
      endedTransaction = transaction
    })

    const res = await helpers.makeRequest('/static/standard')
    t.equal(res.statusCode, 200)

    t.ok(endedTransaction)
    t.equal(endedTransaction.name, `${NEXT_TRANSACTION_PREFIX}/static/standard`)
  })

  t.test('should properly name static, dynamic route, page', async (t) => {
    let endedTransaction = null
    agent.agent.on('transactionFinished', (transaction) => {
      endedTransaction = transaction
    })

    const res = await helpers.makeRequest('/static/dynamic/testing')
    t.equal(res.statusCode, 200)

    t.ok(endedTransaction)
    t.equal(endedTransaction.name, `${NEXT_TRANSACTION_PREFIX}/static/dynamic/[value]`)
  })

  t.test('should properly name server-side rendered, non-dynamic route, page', async (t) => {
    let endedTransaction = null
    agent.agent.on('transactionFinished', (transaction) => {
      endedTransaction = transaction
    })

    const res = await helpers.makeRequest('/ssr/people')
    t.equal(res.statusCode, 200)

    t.ok(endedTransaction)
    t.equal(endedTransaction.name, `${NEXT_TRANSACTION_PREFIX}/ssr/people`)
  })

  t.test('should properly name server-side rendered, dynamic route, page', async (t) => {
    let endedTransaction = null
    agent.agent.on('transactionFinished', (transaction) => {
      endedTransaction = transaction
    })

    const res = await helpers.makeRequest('/ssr/dynamic/person/1')
    t.equal(res.statusCode, 200)

    t.ok(endedTransaction)
    t.equal(endedTransaction.name, `${NEXT_TRANSACTION_PREFIX}/ssr/dynamic/person/[id]`)
  })

  t.test('should properly name API with non-dynamic route', async (t) => {
    let endedTransaction = null
    agent.agent.on('transactionFinished', (transaction) => {
      endedTransaction = transaction
    })

    const res = await helpers.makeRequest('/api/hello')
    t.equal(res.statusCode, 200)

    t.ok(endedTransaction)
    t.equal(endedTransaction.name, `${NEXT_TRANSACTION_PREFIX}/api/hello`)
  })

  t.test('should properly name API with dynamic route', async (t) => {
    let endedTransaction = null
    agent.agent.on('transactionFinished', (transaction) => {
      endedTransaction = transaction
    })

    const res = await helpers.makeRequest('/api/person/2')
    t.equal(res.statusCode, 200)

    t.ok(endedTransaction)
    t.equal(endedTransaction.name, `${NEXT_TRANSACTION_PREFIX}/api/person/[id]`)
  })

  t.test('should properly name transactions with server-side rendered calling API', async (t) => {
    const transactions = []
    agent.agent.on('transactionFinished', (transaction) => {
      transactions.push(transaction)
    })

    const res = await helpers.makeRequest('/person/2')
    t.equal(res.statusCode, 200)

    t.equal(transactions.length, 2)

    const apiTransaction = transactions.find((transaction) => {
      return transaction.name === `${NEXT_TRANSACTION_PREFIX}/api/person/[id]`
    })

    const pageTransaction = transactions.find((transaction) => {
      return transaction.name === `${NEXT_TRANSACTION_PREFIX}/person/[id]`
    })

    t.ok(apiTransaction, 'should find transaction matching person API call')
    t.ok(pageTransaction, 'should find transaction matching person page call')
  })
})
