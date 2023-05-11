/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const helper = require('../../lib/agent_helper')
const { findSegment } = require('../../lib/metrics_helper')
const { verify, verifySlowQueries, findMany, raw, rawUpdate } = require('./utils')
const { initPrismaApp, getPostgresUrl } = require('./setup')
const { upsertUsers } = require('./app')

tap.test('Basic run through prisma functionality', { timeout: 30 * 1000 }, (t) => {
  t.autoend()
  let agent = null
  let PrismaClient = null
  let prisma = null

  t.before(async () => {
    await initPrismaApp()
  })

  t.beforeEach(async () => {
    process.env.DATABASE_URL = getPostgresUrl()
    agent = helper.instrumentMockedAgent()
    ;({ PrismaClient } = require('@prisma/client'))
    prisma = new PrismaClient()
  })

  t.afterEach(async () => {
    delete process.env.DATABASE_URL
    helper.unloadAgent(agent)
    agent = null
    PrismaClient = null
    prisma = null
  })

  t.test('Metrics and traces are recorded with a transaction', (t) => {
    agent.config.datastore_tracer.instance_reporting.enabled = true
    agent.config.datastore_tracer.database_name_reporting.enabled = true

    helper.runInTransaction(agent, async (tx) => {
      const users = await upsertUsers(prisma)
      t.equal(users.length, 2, 'should get two users')
      tx.end()
      verify(t, agent, tx)
      t.end()
    })
  })

  t.test('should not add datastore instance attributes to trace segments if disabled', (t) => {
    // Disable.
    agent.config.datastore_tracer.instance_reporting.enabled = false
    agent.config.datastore_tracer.database_name_reporting.enabled = false

    helper.runInTransaction(agent, async (tx) => {
      const users = await upsertUsers(prisma)
      t.equal(users.length, 2, 'should get two users')
      const findManySegment = findSegment(tx.trace.root, findMany)
      const attributes = findManySegment.getAttributes()
      t.notOk(attributes.host, 'should not have a host set')
      t.notOk(attributes.port_path_or_id, 'should not have a port set')
      t.notOk(attributes.database_name, 'should not have a database name set')
      t.equal(attributes.product, 'Prisma', 'product attribute should be "Prisma"')
      t.end()
    })
  })

  t.test('Raw queries should be recorded', async (t) => {
    const queries = [
      prisma.$queryRaw`SELECT * FROM "User"`,
      prisma.$queryRawUnsafe('SELECT * FROM "User"')
    ]
    for (const query of queries) {
      await helper.runInTransaction(agent, async (tx) => {
        const users = await query
        t.equal(users.length, 2, 'should get two users')
        tx.end()
        const rawSegment = findSegment(tx.trace.root, raw)
        t.ok(rawSegment, `segment named ${raw} should exist`)
      })
    }
    t.end()
  })

  t.test('Raw statements should be recorded', async (t) => {
    const queries = [
      prisma.$executeRaw`UPDATE "User" SET "name"='New Relic was here'`,
      prisma.$executeRawUnsafe('UPDATE "User" SET "name"=\'New Relic was here\'')
    ]
    for (const query of queries) {
      await helper.runInTransaction(agent, async (tx) => {
        const count = await query
        t.equal(count, 2, 'should modify two users')
        tx.end()
        const rawSegment = findSegment(tx.trace.root, rawUpdate)
        t.ok(rawSegment, `segment named ${rawUpdate} should exist`)
      })
    }
    t.end()
  })

  t.test('should add datastore instance params to slow query traces', (t) => {
    // enable slow queries
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    helper.runInTransaction(agent, async (tx) => {
      await prisma.$executeRaw`select * from pg_sleep(1);`
      await upsertUsers(prisma)
      tx.end()
      verifySlowQueries(t, agent, ['select * from pg_sleep(1);', 'user.findMany', 'user.update'])
      t.end()
    })
  })

  t.test('should not add datastore instance params to slow query traces when disabled', (t) => {
    // enable slow queries
    agent.config.transaction_tracer.explain_threshold = 0
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true
    // disable datastore instance
    agent.config.datastore_tracer.instance_reporting.enabled = false
    agent.config.datastore_tracer.database_name_reporting.enabled = false

    helper.runInTransaction(agent, async (tx) => {
      await prisma.$executeRaw`select * from User;`
      tx.end()
      const queryParams = agent.queries.samples.values().next().value
      t.notOk(queryParams.host, 'should not have a host set')
      t.notOk(queryParams.port_path_or_id, 'should not have a port set')
      t.notOk(queryParams.database_name, 'should not have a database name set')

      t.end()
    })
  })
})
