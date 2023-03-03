/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const helper = require('../../lib/agent_helper')
const { DB, PRISMA } = require('../../../lib/metrics/names')
const { assertSegments, findSegment } = require('../../lib/metrics_helper')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')

const { initPrismaApp, getPostgresUrl } = require('./setup')
const { upsertUsers } = require('./app')
const findMany = `${PRISMA.STATEMENT}user/findMany`
const update = `${PRISMA.STATEMENT}user/update`

const expectedUpsertMetrics = {
  [`${DB.ALL}`]: 4,
  [`${DB.PREFIX}${DB.WEB}`]: 4,
  [`${PRISMA.OPERATION}findMany`]: 2,
  [`${PRISMA.STATEMENT}user/findMany`]: 2,
  [`${PRISMA.OPERATION}update`]: 2,
  [`${PRISMA.STATEMENT}user/update`]: 2,
  [`${DB.PREFIX}${PRISMA.PREFIX}/${DB.WEB}`]: 4,
  [`${DB.PREFIX}${PRISMA.PREFIX}/all`]: 4
}

tap.test('Basic run through prisma functionality', { timeout: 30 * 1000 }, async (t) => {
  await initPrismaApp()
  // Require seed after the prisma app has been init
  const seed = require('./prisma/seed')

  let agent = null
  let PrismaClient = null
  let prisma = null
  let host = null

  t.beforeEach(async () => {
    process.env.DATABASE_URL = getPostgresUrl()
    agent = helper.instrumentMockedAgent()
    PrismaClient = require('@prisma/client').PrismaClient
    prisma = new PrismaClient()
    host = urltils.isLocalhost(params.postgres_host)
      ? agent.config.getHostnameSafe()
      : params.postgrs_host
    await seed()
  })

  t.afterEach(async () => {
    delete process.env.DATABASE_URL
    helper.unloadAgent(agent)
    agent = null
    PrismaClient = null
    prisma = null
  })

  function verifyMetrics(t) {
    for (const [metricName, expectedCount] of Object.entries(expectedUpsertMetrics)) {
      const metric = agent.metrics.getMetric(metricName)
      t.equal(
        metric.callCount,
        expectedCount,
        `should have counted ${metricName} ${expectedCount} times`
      )
    }
  }

  function verifyTraces(t, transaction) {
    const trace = transaction.trace
    t.ok(trace, 'trace should exist')
    t.ok(trace.root, 'root element should exist')

    assertSegments(trace.root, [findMany, update, update, findMany], { exact: true })
    const findManySegment = findSegment(trace.root, findMany)
    t.ok(findManySegment.timer.hrDuration, 'findMany segment should have ended')
    const updateSegment = findSegment(trace.root, update)
    t.ok(updateSegment.timer.hrDuration, 'update segment should have ended')
    for (const segment of [findManySegment, updateSegment]) {
      const attributes = segment.getAttributes()
      const name = segment.name
      t.equal(attributes.host, host, `host of segment ${name} should equal ${host}`)
      t.equal(
        attributes.database_name,
        params.postgres_db,
        `database name of segment ${name} should be ${params.postgres_db}`
      )
      t.equal(
        attributes.port_path_or_id,
        params.postgres_prisma_port.toString(),
        `port of segment ${name} should be ${params.postgres_prisma_port}`
      )
    }
  }

  function verify(t, transaction) {
    verifyMetrics(t)
    verifyTraces(t, transaction)
  }

  t.test('Metrics and traces are recorded with a transaction', (t) => {
    agent.config.datastore_tracer.instance_reporting.enabled = true
    agent.config.datastore_tracer.database_name_reporting.enabled = true

    helper.runInTransaction(agent, async (tx) => {
      const users = await upsertUsers(prisma)
      t.equal(users.length, 2, 'should get two users')
      tx.end()
      verify(t, tx)
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
    // Note that in raw queries we get the raw table name, which in
    // this case is capitalised.
    const queryRaw = `${PRISMA.STATEMENT}User/queryRaw(select)`

    // We want to try the query two ways, both with and without
    // namespacing the table, to make sure we always parse correctly
    // and get the table.
    const queries = [
      prisma.$queryRaw`SELECT * FROM "public"."User"`,
      prisma.$queryRaw`SELECT * FROM "User"`,
      prisma.$queryRawUnsafe('SELECT * FROM "public"."User"'),
      prisma.$queryRawUnsafe('SELECT * FROM "User"')
    ]
    for (const query of queries) {
      await helper.runInTransaction(agent, async (tx) => {
        const users = await query
        t.equal(users.length, 2, 'should get two users')
        tx.end()
        const rawSegment = findSegment(tx.trace.root, queryRaw)
        t.ok(rawSegment, `segment named ${queryRaw} should exist`)
      })
    }
    t.end()
  })

  t.test('Raw statements should be recorded', async (t) => {
    // Note that in raw queries we get the raw table name, which in
    // this case is capitalised.
    const statementRaw = `${PRISMA.STATEMENT}User/executeRaw(update)`

    // We want to try the query two ways, both with and without
    // namespacing the table, to make sure we always parse correctly
    // and get the table.
    const queries = [
      prisma.$executeRaw`UPDATE "public"."User" SET "name"='New Relic was here'`,
      prisma.$executeRaw`UPDATE "User" SET "name"='New Relic was here'`,
      prisma.$executeRawUnsafe('UPDATE "public"."User" SET "name"=\'New Relic was here\''),
      prisma.$executeRawUnsafe('UPDATE "User" SET "name"=\'New Relic was here\'')
    ]
    for (const query of queries) {
      await helper.runInTransaction(agent, async (tx) => {
        const count = await query
        t.equal(count, 2, 'should modify two users')
        tx.end()
        const rawSegment = findSegment(tx.trace.root, statementRaw)
        t.ok(rawSegment, `segment named ${statementRaw} should exist`)
      })
    }
    t.end()
  })
})
