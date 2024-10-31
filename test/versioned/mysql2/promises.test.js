/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const setup = require('../mysql/setup')
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')
const { DATABASE, USER, TABLE } = require('./constants')

test('mysql2 promises', { timeout: 30000 }, async (t) => {
  t.beforeEach(async (ctx) => {
    await setup(USER, DATABASE, TABLE, require('mysql2'))
    const agent = helper.instrumentMockedAgent()

    const mysql = require('mysql2/promise')

    const client = await mysql.createConnection({
      user: USER,
      database: DATABASE,
      host: params.mysql_host,
      port: params.mysql_port
    })
    ctx.nr = {
      agent,
      client
    }
  })

  t.afterEach(async (ctx) => {
    const { agent, client } = ctx.nr
    helper.unloadAgent(agent)
    await client.end()
  })

  await t.test('basic transaction', async (t) => {
    const { agent, client } = t.nr
    await helper.runInTransaction(agent, async (tx) => {
      await client.query('SELECT 1')
      const activeTx = agent.getTransaction()
      assert.equal(tx.name, activeTx.name)
      tx.end()
    })
    checkQueries(agent)
  })

  await t.test('query with values', async (t) => {
    const { agent, client } = t.nr
    await helper.runInTransaction(agent, async (tx) => {
      await client.query('SELECT 1', [])
      const activeTx = agent.getTransaction()
      assert.equal(tx.name, activeTx.name)
      tx.end()
    })
    checkQueries(agent)
  })

  await t.test('database name should change with use statement', async (t) => {
    const { agent, client } = t.nr
    await helper.runInTransaction(agent, async (tx) => {
      await client.query('create database if not exists test_db')
      let activeTx = agent.getTransaction()
      assert.equal(tx.name, activeTx.name)
      await client.query('use test_db')
      activeTx = agent.getTransaction()
      assert.equal(tx.name, activeTx.name)
      await client.query('SELECT 1 + 1 AS solution')
      activeTx = agent.getTransaction()
      assert.equal(tx.name, activeTx.name)

      const [, , segment] = tx.trace.getChildren(tx.trace.root.id)
      const attributes = segment.getAttributes()
      assert.equal(
        attributes.host,
        urltils.isLocalhost(params.mysql_host) ? agent.config.getHostnameSafe() : params.mysql_host,
        'should set host name'
      )
      assert.equal(attributes.database_name, 'test_db', 'should follow use statement')
      assert.equal(attributes.port_path_or_id, '3306', 'should set port')
      tx.end()
    })
    checkQueries(agent)
  })

  await t.test('query with options object rather than sql', async (t) => {
    const { agent, client } = t.nr
    await helper.runInTransaction(agent, async (tx) => {
      await client.query({ sql: 'SELECT 1' })
      const activeTx = agent.getTransaction()
      assert.equal(tx.name, activeTx.name)
      tx.end()
    })
    checkQueries(agent)
  })

  await t.test('query with options object and values', async (t) => {
    const { agent, client } = t.nr
    await helper.runInTransaction(agent, async (tx) => {
      await client.query({ sql: 'SELECT 1' }, [])
      const activeTx = agent.getTransaction()
      assert.equal(tx.name, activeTx.name)
      tx.end()
    })
    checkQueries(agent)
  })
})

function checkQueries(agent) {
  const querySamples = agent.queries.samples
  assert.ok(querySamples.size > 0, 'there should be a query sample')
  for (const sample of querySamples.values()) {
    assert.ok(sample.total > 0, 'the samples should have positive duration')
  }
}
