/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const http = require('http')

const helper = require('../../lib/agent_helper')

const originalSetImmediate = setImmediate

tap.test('fastify with new state tracking', (t) => {
  t.autoend()

  let agent = null
  let fastify = null

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent({
      feature_flag: {
        fastify_instrumentation: true,
        new_promise_tracking: true
      }
    })

    fastify = require('fastify')()
  })

  t.afterEach(() => {
    helper.unloadAgent(agent)
    fastify.close()
  })

  t.test('should not reuse transactions via normal usage', async (t) => {
    fastify.get('/', async () => {
      return { hello: 'world' }
    })

    await fastify.listen(0)

    const port = fastify.server.address().port
    const url = `http://localhost:${port}/`

    const transactions = []
    agent.on('transactionFinished', (transaction) => {
      transactions.push(transaction)
    })

    await makeRequestPromise(url)
    await makeRequestPromise(url)

    t.equal(transactions.length, 2)
  })

  t.test('should not reuse transactions with non-awaited promise', async (t) => {
    fastify.get('/', async () => {
      doWork() // fire-and-forget promise
      return { hello: 'world' }
    })

    function doWork() {
      return new Promise((resolve) => {
        // async hop w/o context tracking
        originalSetImmediate(resolve)
      })
    }

    await fastify.listen(0)

    const port = fastify.server.address().port
    const url = `http://localhost:${port}/`

    const transactions = []
    agent.on('transactionFinished', (transaction) => {
      transactions.push(transaction)
    })

    await makeRequestPromise(url)
    await makeRequestPromise(url)

    t.equal(transactions.length, 2)
  })
})

function makeRequest(url, cb) {
  http.get(url, (res) => {
    res.resume()
    res.on('end', () => {
      cb()
    })
  })
}

function makeRequestPromise(url) {
  return new Promise((resolve) => {
    makeRequest(url, resolve)
  })
}
