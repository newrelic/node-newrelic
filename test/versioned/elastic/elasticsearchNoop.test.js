/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const DB_INDEX = helper.randomString('test-')

test('Elasticsearch instrumentation', async (t) => {
  t.beforeEach(async (ctx) => {
    const agent = helper.instrumentMockedAgent()

    // need to capture attributes
    agent.config.attributes.enabled = true
    const { Client } = require('@elastic/elasticsearch')

    const client = new Client({
      node: `http://${params.elastic_host}:${params.elastic_port}`
    })
    ctx.nr = {
      agent,
      client
    }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test(
    'unsupported version should noop db tracing, but record web transaction',
    async (t) => {
      const { agent, client } = t.nr
      await helper.runInTransaction(agent, async function transactionInScope(transaction) {
        try {
          await client.indices.create({ index: DB_INDEX })
        } catch (e) {
          assert.ok(!e, 'should not error')
        }
        const [firstChild] = transaction.trace.getChildren(transaction.trace.root.id)
        assert.equal(
          firstChild.name,
          `External/localhost:9200/${DB_INDEX}`,
          'should record index creation as an external transaction'
        )
        await client.indices.delete({ index: DB_INDEX })
      })
    }
  )
})
