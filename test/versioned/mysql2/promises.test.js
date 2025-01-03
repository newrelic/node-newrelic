/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const setup = require('../mysql/setup')
const fs = require('fs')
const semver = require('semver')
const test = require('node:test')
const assert = require('node:assert')
const path = require('node:path')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')
const { DATABASE, USER, TABLE } = require('./constants')

// exports are defined in newer versions so must read file directly
let pkgVersion
try {
  ;({ version: pkgVersion } = require('mysql2/package'))
} catch {
  ;({ version: pkgVersion } = JSON.parse(
    fs.readFileSync(path.join(__dirname, '/node_modules/mysql2/package.json'))
  ))
}

test('mysql2 promises', { timeout: 30000 }, async (t) => {
  t.beforeEach(async (ctx) => {
    await setup(USER, DATABASE, TABLE, require('mysql2'))
    const agent = helper.instrumentMockedAgent({
      slow_sql: { enabled: true },
      transaction_tracer: {
        recod_sql: 'raw',
        explain_threshold: 0,
        enabled: true
      }
    })

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

      const segment = agent.getTransaction().trace.root.children[2]
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

test('mysql2 promises pool', async function (t) {
  t.beforeEach(async function (ctx) {
    await setup(USER, DATABASE, TABLE, require('mysql2'))
    const agent = helper.instrumentMockedAgent()
    const mysql = require('mysql2/promise')
    const pool = mysql.createPool({
      user: USER,
      database: DATABASE,
      host: params.mysql_host,
      port: params.mysql_port
    })
    ctx.nr = {
      agent,
      mysql,
      pool
    }
  })

  t.afterEach(async function (ctx) {
    const { pool, agent } = ctx.nr
    helper.unloadAgent(agent)
    await pool.end()
  })

  await t.test('pool.query', async function (t) {
    const { agent, pool } = t.nr
    await helper.runInTransaction(agent, async (tx) => {
      await pool.query('SELECT 1 + 1 AS solution')
      const activeTx = agent.getTransaction()
      assert.equal(tx.name, activeTx.name)
      tx.end()
    })
  })

  await t.test('pool.query with values', async function (t) {
    const { agent, pool } = t.nr
    await helper.runInTransaction(agent, async (tx) => {
      await pool.query('SELECT ? + ? AS solution', [1, 1])
      const activeTx = agent.getTransaction()
      assert.equal(tx.name, activeTx.name)
      tx.end()
    })
  })

  await t.test('pool.getConnection -> connection.query', async function (t) {
    const { agent, pool } = t.nr
    await helper.runInTransaction(agent, async (tx) => {
      const connection = await pool.getConnection()
      t.after(function () {
        connection.release()
      })

      await connection.query('SELECT 1 + 1 AS solution')
      const activeTx = agent.getTransaction()
      assert.equal(tx.name, activeTx.name)
      tx.end()
    })
  })

  await t.test('pool.getConnection -> connection.query with values', async function (t) {
    const { agent, pool } = t.nr
    await helper.runInTransaction(agent, async (tx) => {
      const connection = await pool.getConnection()
      t.after(function () {
        connection.release()
      })

      await connection.query('SELECT ? + ? AS solution', [1, 1])
      const activeTx = agent.getTransaction()
      assert.equal(tx.name, activeTx.name)
      tx.end()
    })
  })
})

// not added until 2.3.0
// https://github.com/sidorares/node-mysql2/blob/05e9e153a3c8530c957140b59a654a999e7c3c6e/Changelog.md?plain=1#L2
if (semver.satisfies(pkgVersion, '>=2.3.0')) {
  test('mysql2 promises poolCluster', async function (t) {
    t.beforeEach(async function (ctx) {
      await setup(USER, DATABASE, TABLE, require('mysql2'))
      const agent = helper.instrumentMockedAgent()
      const mysql = require('mysql2/promise')
      const poolCluster = mysql.createPoolCluster()

      const config = {
        user: USER,
        database: DATABASE,
        host: params.mysql_host,
        port: params.mysql_port
      }

      poolCluster.add(config) // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)
      ctx.nr = {
        agent,
        mysql,
        poolCluster
      }
    })

    t.afterEach(async function (ctx) {
      const { agent, poolCluster } = ctx.nr
      helper.unloadAgent(agent)
      await poolCluster.end()
    })

    await t.test('get any connection', async function (t) {
      const { agent, poolCluster } = t.nr
      const connection = await poolCluster.getConnection()
      await helper.runInTransaction(agent, async (tx) => {
        await connection.query('SELECT ? + ? AS solution', [1, 1])
        const activeTx = agent.getTransaction()
        assert.equal(tx.name, activeTx.name)
        tx.end()
        connection.release()
      })
    })

    await t.test('get MASTER connection', async function (t) {
      const { agent, poolCluster } = t.nr
      const connection = await poolCluster.getConnection('MASTER')
      await helper.runInTransaction(agent, async (tx) => {
        await connection.query('SELECT ? + ? AS solution', [1, 1])
        const activeTx = agent.getTransaction()
        assert.equal(tx.name, activeTx.name)
        tx.end()
        connection.release()
      })
    })

    await t.test('get glob', async function (t) {
      const { agent, poolCluster } = t.nr
      const connection = await poolCluster.getConnection('REPLICA*', 'ORDER')
      await helper.runInTransaction(agent, async (tx) => {
        await connection.query('SELECT ? + ? AS solution', [1, 1])
        const activeTx = agent.getTransaction()
        assert.equal(tx.name, activeTx.name)
        tx.end()
        connection.release()
      })
    })

    // does not work until mysql2 bug is fixed
    // https://github.com/sidorares/node-mysql2/issues/3091
    if (!semver.satisfies(pkgVersion, '>=3.11.1 <3.13.0')) {
      await t.test('get star', async function (t) {
        const { agent, poolCluster } = t.nr
        const connection = await poolCluster.of('*').getConnection()
        await helper.runInTransaction(agent, async (tx) => {
          await connection.query('SELECT ? + ? AS solution', [1, 1])
          const activeTx = agent.getTransaction()
          assert.equal(tx.name, activeTx.name)
          tx.end()
          connection.release()
        })
      })

      await t.test('get wildcard', async function (t) {
        const { agent, poolCluster } = t.nr
        const pool = poolCluster.of('REPLICA*', 'RANDOM')
        const connection = await pool.getConnection()
        await helper.runInTransaction(agent, async (tx) => {
          await connection.query('SELECT ? + ? AS solution', [1, 1])
          const activeTx = agent.getTransaction()
          assert.equal(tx.name, activeTx.name)
          tx.end()
          connection.release()
        })
      })
    }

    await t.test('poolCluster query', async function (t) {
      const { agent, poolCluster } = t.nr
      const masterPool = poolCluster.of('MASTER', 'RANDOM')
      const replicaPool = poolCluster.of('REPLICA', 'RANDOM')
      await helper.runInTransaction(agent, async (tx) => {
        await replicaPool.query('SELECT ? + ? AS solution', [1, 1])
        await masterPool.query('SELECT ? + ? AS solution', [1, 1])
        const activeTx = agent.getTransaction()
        assert.equal(tx.name, activeTx.name)
        tx.end()
      })
    })
  })
}

function checkQueries(agent) {
  const querySamples = agent.queries.samples
  assert.ok(querySamples.size > 0, 'there should be a query sample')
  for (const sample of querySamples.values()) {
    assert.ok(sample.total > 0, 'the samples should have positive duration')
  }
}
