/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const promiseResolvers = require('../../lib/promise-resolvers')
const { redis_tls_host: HOST, redis_tls_port: PORT } = require('../../lib/params')
const { removeModules } = require('../../lib/cache-buster')

test('redis over tls connection', async (t) => {
  t.afterEach(() => {
    removeModules(['redis'])
  })

  await t.test('should work with self-signed tls cert on server', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const agent = helper.instrumentMockedAgent()
    const redis = require('redis')
    const client = redis.createClient({
      url: `rediss://${HOST}:${PORT}`,
      socket: {
        tls: true,
        rejectUnauthorized: false
      }
    })
    await client.connect()
    await client.flushAll()

    t.after(async () => {
      await client.flushAll()
      await client.disconnect()
      helper.unloadAgent(agent)
    })

    helper.runInTransaction(agent, async function transactionInScope() {
      const tx = agent.getTransaction()
      await client.set('tls-test', 'foo')
      const found = await client.get('tls-test')
      assert.equal(found, 'foo')
      tx.end()
      resolve()
    })

    await promise
  })

  await t.test('url parsing should add tls true', async (t) => {
    const { promise, resolve } = promiseResolvers()
    const agent = helper.instrumentMockedAgent()
    const redis = require('redis')
    const client = redis.createClient({
      url: `rediss://${HOST}:${PORT}`,
      socket: {
        rejectUnauthorized: false
      }
    })
    await client.connect()
    await client.flushAll()

    t.after(async () => {
      await client.flushAll()
      await client.disconnect()
      helper.unloadAgent(agent)
    })

    helper.runInTransaction(agent, async function transactionInScope() {
      const tx = agent.getTransaction()
      await client.set('tls-test', 'foo')
      const found = await client.get('tls-test')
      assert.equal(found, 'foo')
      tx.end()
      resolve()
    })

    await promise
  })
})
