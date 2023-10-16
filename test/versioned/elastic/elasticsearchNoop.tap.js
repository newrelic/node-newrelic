/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const crypto = require('crypto')
const DB_INDEX = `test-${randomString()}`

function randomString() {
  return crypto.randomBytes(5).toString('hex')
}

test('Elasticsearch instrumentation', (t) => {
  t.autoend()

  let agent
  let client

  t.before(async () => {
    agent = helper.instrumentMockedAgent()

    // need to capture attributes
    agent.config.attributes.enabled = true
    const { Client } = require('@elastic/elasticsearch')

    client = new Client({
      node: `http://${params.elastic_host}:${params.elastic_port}`
    })
  })

  t.afterEach(() => {
    agent.queries.clear()
  })

  t.teardown(() => {
    agent && helper.unloadAgent(agent)
  })

  t.test('unsupported version should noop db tracing, but record web transaction', async (t) => {
    await helper.runInTransaction(agent, async function transactionInScope(transaction) {
      try {
        await client.indices.create({ index: DB_INDEX })
      } catch (e) {
        t.notOk(e, 'should not error')
      }
      const firstChild = transaction?.trace?.root?.children[0]
      t.equal(
        firstChild.name,
        `External/localhost:9200/`,
        'should record index creation as an external transaction'
      )
      await client.indices.delete({ index: DB_INDEX })
    })
  })
})
