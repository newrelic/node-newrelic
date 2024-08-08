/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const { removeModules } = require('../../lib/cache-buster')

tap.test('redis over tls connection', (t) => {
  t.beforeEach(async (t) => {
    t.agent = helper.instrumentMockedAgent()
    t.redis = require('redis')
    t.client = await t.redis
      .createClient({
        socket: {
          port: 6380,
          host: '127.0.0.1',
          tls: true,
          rejectUnauthorized: false
        }
      })
      .on('error', (error) => {
        throw error
      })
      .connect()
    await t.client.flushAll()
  })

  t.afterEach(async (t) => {
    await t.client.flushAll()
    await t.client.disconnect()
    helper.unloadAgent(t.agent)
    removeModules(['redis'])
  })

  t.test('should work with self-signed tls cert on server', (t) => {
    const { agent, client } = t
    helper.runInTransaction(agent, async function transactionInScope() {
      const tx = agent.getTransaction()
      await client.set('tls-test', 'foo')
      const found = await client.get('tls-test')
      t.equal(found, 'foo')
      tx.end()
      t.end()
    })
  })

  t.end()
})
