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
    assert.equal(sample.total > 0, true, 'sample should have positive duration')

    const metrics = agent.metrics._metrics.unscoped
    const expectedMetrics = [
      'Datastore/better-sqlite3/all',
      'Datastore/better-sqlite3/allWeb',
      'Datastore/instance/better-sqlite3/localhost/0',
      'Datastore/operation/better-sqlite3/insert',
      'Datastore/statement/better-sqlite3/users/insert'
    ]
    for (const expectedMetric of expectedMetrics) {
      assert.equal(metrics[expectedMetric].callCount, 1)
    }

    end()
  })
})
