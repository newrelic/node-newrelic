/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const setup = require('./setup')
const tap = require('tap')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')

const { USER, DATABASE } = setup

tap.test('mysql2 promises', { timeout: 30000 }, (t) => {
  t.autoend()

  let mysql = null
  let client = null
  let agent = null

  t.beforeEach(async () => {
    await setup(require('mysql2'))
    agent = helper.instrumentMockedAgent()

    mysql = require('mysql2/promise')

    client = await mysql.createConnection({
      user: USER,
      database: DATABASE,
      host: params.mysql_host,
      port: params.mysql_port
    })
  })

  t.afterEach(async () => {
    helper.unloadAgent(agent)
    if (client) {
      await client.end()
      client = null
    }
  })

  t.test('basic transaction', (t) => {
    return helper
      .runInTransaction(agent, (tx) => {
        return client.query('SELECT 1').then(() => {
          const activeTx = agent.getTransaction()
          t.equal(tx.name, activeTx.name)
          tx.end()
        })
      })
      .then(() => checkQueries(t, agent))
  })

  t.test('query with values', (t) => {
    return helper
      .runInTransaction(agent, (tx) => {
        return client.query('SELECT 1', []).then(() => {
          const activeTx = agent.getTransaction()
          t.equal(tx.name, activeTx.name)
          tx.end()
        })
      })
      .then(() => checkQueries(t, agent))
  })

  t.test('database name should change with use statement', (t) => {
    return helper
      .runInTransaction(agent, (tx) => {
        return client
          .query('create database if not exists test_db')
          .then(() => {
            const activeTx = agent.getTransaction()
            t.equal(tx.name, activeTx.name)
            return client.query('use test_db')
          })
          .then(() => {
            const activeTx = agent.getTransaction()
            t.equal(tx.name, activeTx.name)
            return client.query('SELECT 1 + 1 AS solution')
          })
          .then(() => {
            const activeTx = agent.getTransaction()
            t.equal(tx.name, activeTx.name)

            const [, , segment] = tx.trace.getChildren(tx.trace.root.id)
            const attributes = segment.getAttributes()
            t.equal(
              attributes.host,
              urltils.isLocalhost(params.mysql_host)
                ? agent.config.getHostnameSafe()
                : params.mysql_host,
              'should set host name'
            )
            t.equal(attributes.database_name, 'test_db', 'should follow use statement')
            t.equal(attributes.port_path_or_id, '3306', 'should set port')

            tx.end()
          })
      })
      .then(() => checkQueries(t, agent))
  })

  t.test('query with options object rather than sql', (t) => {
    return helper
      .runInTransaction(agent, (tx) => {
        return client.query({ sql: 'SELECT 1' }).then(() => {
          const activeTx = agent.getTransaction()
          t.equal(tx.name, activeTx.name)
          tx.end()
        })
      })
      .then(() => checkQueries(t, agent))
  })

  t.test('query with options object and values', (t) => {
    return helper
      .runInTransaction(agent, (tx) => {
        return client.query({ sql: 'SELECT 1' }, []).then(() => {
          const activeTx = agent.getTransaction()
          t.equal(tx.name, activeTx.name)
          tx.end()
        })
      })
      .then(() => checkQueries(t, agent))
  })
})

function checkQueries(t, agent) {
  const querySamples = agent.queries.samples
  t.ok(querySamples.size > 0, 'there should be a query sample')
  for (const sample of querySamples.values()) {
    t.ok(sample.total > 0, 'the samples should have positive duration')
  }
}
