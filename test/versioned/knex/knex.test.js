/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const test = require('node:test')

const helper = require('../../lib/agent_helper')
const { removeModules } = require('../../lib/cache-buster')

test.beforeEach(async ctx => {
  ctx.nr = {}

  ctx.nr.agent = helper.instrumentMockedAgent({
    opentelemetry_bridge: {
      enabled: true,
      traces: { enabled: true }
    },
    slow_sql: { enabled: true },
    transaction_tracer: {
      record_sql: 'raw',
      explain_threshold: 0,
      enabled: true
    }
  })

  // const sqlite = require('better-sqlite3')
  const knex = require('knex')({
    client: 'better-sqlite3',
    connection: {
      filename: ':memory:'
    },
    useNullAsDefault: true
  })
  ctx.nr.knex = knex

  await knex.schema.createTable('users', table => {
    table.string('username')
    table.string('email')
  })
})

test.afterEach(ctx => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.knex.destroy()
  // TODO: remove otel modules?
  removeModules(['knex', 'better-sqlite3'])
})

test('records queries', (t, end) => {
  const { agent, knex } = t.nr

  helper.runInTransaction(agent, async tx => {
    await knex('users').insert({ username: 'foo', email: 'foo@example.com' })
    tx.end()

    assert.equal(agent.queries.samples.size === 1, true, 'should have recorded query')
    const sample = agent.queries.samples.values().next().value
    assert.equal(sample.trace.query, 'insert into `users` (`email`, `username`) values (?, ?)')

    end()
  })
})
