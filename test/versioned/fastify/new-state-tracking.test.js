/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../lib/agent_helper')
const common = require('./common')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({ feature_flag: { new_promise_tracking: true } })
  ctx.nr.fastify = require('fastify')()
  ctx.nr.originalSetImmediate = global.setImmediate
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.fastify.close()
  global.setImmediate = ctx.nr.originalSetImmediate
})

test('should not reuse transactions via normal usage', async (t) => {
  const { agent, fastify } = t.nr

  fastify.get('/', async () => {
    return { hello: 'world' }
  })

  await fastify.listen({ port: 0 })

  const address = fastify.server.address()

  const transactions = []
  agent.on('transactionFinished', (transaction) => {
    transactions.push(transaction)
  })

  await common.makeRequest(address, '/')
  await common.makeRequest(address, '/')

  assert.equal(transactions.length, 2)
})

test('should not reuse transactions with non-awaited promise', async (t) => {
  const { agent, fastify, originalSetImmediate } = t.nr

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

  await fastify.listen({ port: 0 })

  const address = fastify.server.address()

  const transactions = []
  agent.on('transactionFinished', (transaction) => {
    transactions.push(transaction)
  })

  await common.makeRequest(address, '/')
  await common.makeRequest(address, '/')

  assert.equal(transactions.length, 2)
})
