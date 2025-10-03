/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const { findSegment } = require('../../lib/metrics_helper')
const { verify, verifySlowQueries, findMany, raw, rawUpdate } = require('./utils')
const { initPrismaApp, getPostgresUrl } = require('./setup')
const { upsertUsers } = require('./app')
const { assertPackageMetrics } = require('../../lib/custom-assertions')

const timeout = 30 * 1_000

test.before(async () => {
  await initPrismaApp()
})

test.beforeEach(async (ctx) => {
  process.env.DATABASE_URL = getPostgresUrl()
  const agent = helper.instrumentMockedAgent()
  const { PrismaClient } = require('@prisma/client')
  const prisma = new PrismaClient()
  ctx.nr = {
    agent,
    prisma
  }
})

test.afterEach(async (ctx) => {
  const { agent } = ctx.nr
  delete process.env.DATABASE_URL
  helper.unloadAgent(agent)
})

test('should log tracking metrics', function(t) {
  const { agent } = t.nr
  const { version } = require('@prisma/client/package.json')
  assertPackageMetrics({ agent, pkg: '@prisma/client', version })
})

test('Metrics and traces are recorded with a transaction', { timeout }, async (t) => {
  const { agent, prisma } = t.nr
  agent.config.datastore_tracer.instance_reporting.enabled = true
  agent.config.datastore_tracer.database_name_reporting.enabled = true

  await helper.runInTransaction(agent, async (tx) => {
    const users = await upsertUsers(prisma)
    assert.equal(users.length, 2, 'should get two users')
    tx.end()
    verify(agent, tx)
  })
})

test(
  'should not add datastore instance attributes to trace segments if disabled',
  { timeout },
  async (t) => {
    const { agent, prisma } = t.nr
    // Disable.
    agent.config.datastore_tracer.instance_reporting.enabled = false
    agent.config.datastore_tracer.database_name_reporting.enabled = false

    await helper.runInTransaction(agent, async (tx) => {
      const users = await upsertUsers(prisma)
      assert.equal(users.length, 2, 'should get two users')
      const findManySegment = findSegment(tx.trace, tx.trace.root, findMany)
      const attributes = findManySegment.getAttributes()
      assert.ok(!attributes.host, 'should not have a host set')
      assert.ok(!attributes.port_path_or_id, 'should not have a port set')
      assert.ok(!attributes.database_name, 'should not have a database name set')
      assert.equal(attributes.product, 'Prisma', 'product attribute should be "Prisma"')
    })
  }
)

test('Raw queries should be recorded', { timeout }, async (t) => {
  const { agent, prisma } = t.nr
  const queries = [
    prisma.$queryRaw`SELECT * FROM "User"`,
    prisma.$queryRawUnsafe('SELECT * FROM "User"')
  ]
  for (const query of queries) {
    await helper.runInTransaction(agent, async (tx) => {
      const users = await query
      assert.equal(users.length, 2, 'should get two users')
      tx.end()
      const rawSegment = findSegment(tx.trace, tx.trace.root, raw)
      assert.ok(rawSegment, `segment named ${raw} should exist`)
    })
  }
})

test('Raw statements should be recorded', { timeout }, async (t) => {
  const { agent, prisma } = t.nr
  const queries = [
    prisma.$executeRaw`UPDATE "User" SET "name"='New Relic was here'`,
    prisma.$executeRawUnsafe('UPDATE "User" SET "name"=\'New Relic was here\'')
  ]
  for (const query of queries) {
    await helper.runInTransaction(agent, async (tx) => {
      const count = await query
      assert.equal(count, 2, 'should modify two users')
      tx.end()
      const rawSegment = findSegment(tx.trace, tx.trace.root, rawUpdate)
      assert.ok(rawSegment, `segment named ${rawUpdate} should exist`)
    })
  }
})

test('should add datastore instance params to slow query traces', { timeout }, async (t) => {
  const { agent, prisma } = t.nr
  // enable slow queries
  agent.config.transaction_tracer.explain_threshold = 0
  agent.config.transaction_tracer.record_sql = 'raw'
  agent.config.slow_sql.enabled = true
  await helper.runInTransaction(agent, async (tx) => {
    await prisma.$executeRaw`select * from pg_sleep(1);`
    await upsertUsers(prisma)
    tx.end()
    verifySlowQueries(agent, ['select * from pg_sleep(1);', 'user.findMany', 'user.update'])
  })
})

test(
  'should not add datastore instance params to slow query traces when disabled',
  { timeout },
  async (t) => {
    const { agent, prisma } = t.nr
    // enable slow queries
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    // disable datastore instance
    agent.config.datastore_tracer.instance_reporting.enabled = false
    agent.config.datastore_tracer.database_name_reporting.enabled = false

    await helper.runInTransaction(agent, async (tx) => {
      await prisma.$executeRaw`select * from User;`
      tx.end()
      const queryParams = agent.queries.samples.values().next().value
      assert.ok(!queryParams.host, 'should not have a host set')
      assert.ok(!queryParams.port_path_or_id, 'should not have a port set')
      assert.ok(!queryParams.database_name, 'should not have a database name set')
    })
  }
)
