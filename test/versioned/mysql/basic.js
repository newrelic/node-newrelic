/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

process.env.NEW_RELIC_HOME = __dirname

const test = require('node:test')
const assert = require('node:assert')
const logger = require('../../../lib/logger')
const helper = require('../../lib/agent_helper')
const urltils = require('../../../lib/util/urltils')
const params = require('../../lib/params')
const setup = require('./setup')
const { getClient } = require('./utils')
const { findSegment } = require('../../lib/metrics_helper')

module.exports = function ({ lib, factory, poolFactory, constants }) {
  const { USER, DATABASE, TABLE } = constants
  test('Basic run through mysql functionality', { timeout: 30 * 1000 }, async function (t) {
    t.beforeEach(async function (ctx) {
      const poolLogger = logger.child({ component: 'pool' })
      const agent = helper.instrumentMockedAgent()
      const mysql = factory()
      const genericPool = poolFactory()
      const pool = setup.pool(USER, DATABASE, mysql, genericPool, poolLogger)
      await setup(USER, DATABASE, TABLE, mysql)
      ctx.nr = {
        agent,
        mysql,
        pool
      }
    })

    t.afterEach(function (ctx) {
      const { agent, pool } = ctx.nr
      return new Promise((resolve) => {
        pool.drain(function () {
          pool.destroyAllNow()
          helper.unloadAgent(agent)
          resolve()
        })
      })
    })

    await t.test('basic transaction', function testTransaction(t, end) {
      const { agent, pool } = t.nr
      assert.ok(!agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        assert.ok(agent.getTransaction(), 'we should be in a transaction')

        getClient(pool, function (err, client) {
          assert.ok(!err)
          assert.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          client.query('SELECT 1', function (err) {
            assert.ok(!err)
            assert.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
            pool.release(client)
            agent.getTransaction().end()
            assert.ok(agent.queries.samples.size > 0, 'there should be a query sample')
            for (const query of agent.queries.samples.values()) {
              assert.ok(query.total > 0, 'the samples should have positive duration')
            }

            const metrics = agent.metrics._metrics.unscoped
            const hostPortMetric = Object.entries(metrics).find((entry) =>
              /Datastore\/instance\/MySQL\/[0-9a-zA-Z.-]+\/3306/.test(entry[0])
            )
            assert.ok(hostPortMetric, 'has host:port metric')
            assert.equal(hostPortMetric[1].callCount, 1, 'host:port metric has been incremented')

            end()
          })
        })
      })
    })

    await t.test('query with values', function testCallbackOnly(t, end) {
      const { agent, pool } = t.nr
      assert.ok(!agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        assert.ok(agent.getTransaction(), 'we should be in a transaction')

        getClient(pool, function (err, client) {
          assert.ok(!err)
          assert.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          client.query('SELECT 1', [], function (err) {
            assert.ok(!err)
            assert.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
            pool.release(client)
            agent.getTransaction().end()
            assert.ok(agent.queries.samples.size > 0, 'there should be a query sample')
            for (const query of agent.queries.samples.values()) {
              assert.ok(query.total > 0, 'the samples should have positive duration')
            }
            end()
          })
        })
      })
    })

    await t.test('query with options streaming should work', function testCallbackOnly(t, end) {
      const { agent, pool } = t.nr
      assert.ok(!agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        assert.ok(agent.getTransaction(), 'we should be in a transaction')
        getClient(pool, function (err, client) {
          assert.ok(!err)
          assert.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          const query = client.query('SELECT 1', [])
          let results = false

          query.on('result', function () {
            results = true
          })

          query.on('error', function (err) {
            assert.ok(!err)
          })

          query.on('end', function () {
            assert.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
            pool.release(client)
            assert.ok(results, 'results should be received')
            agent.getTransaction().end()
            assert.ok(agent.queries.samples.size > 0, 'there should be a query sample')
            for (const sample of agent.queries.samples.values()) {
              assert.ok(sample.total > 0, 'the samples should have positive duration')
            }
            end()
          })
        })
      })
    })

    await t.test('ensure database name changes with a use statement', function (t, end) {
      const { agent, pool } = t.nr
      assert.ok(!agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        assert.ok(agent.getTransaction(), 'we should be in a transaction')
        getClient(pool, function (err, client) {
          assert.ok(!err)
          client.query('create database if not exists test_db;', function (err) {
            assert.ok(!err, 'should not fail to create database')

            client.query('use test_db;', function (err) {
              assert.ok(!err, 'should not fail to set database')

              client.query('SELECT 1 + 1 AS solution', function (err) {
                const seg = tx.trace.getParent(agent.tracer.getSegment().parentId)
                const attributes = seg.getAttributes()

                assert.ok(!err, 'no errors')
                assert.ok(seg, 'there is a segment')
                assert.equal(
                  attributes.host,
                  urltils.isLocalhost(params.mysql_host)
                    ? agent.config.getHostnameSafe()
                    : params.mysql_host,
                  'set host'
                )
                assert.equal(attributes.database_name, 'test_db', 'set database name')
                assert.equal(attributes.port_path_or_id, '3306', 'set port')
                assert.equal(attributes.product, 'MySQL', 'should set product attribute')
                pool.release(client)
                agent.getTransaction().end()
                assert.ok(agent.queries.samples.size > 0, 'there should be a query sample')
                for (const sample of agent.queries.samples.values()) {
                  assert.ok(sample.total > 0, 'the samples should have positive duration')
                }
                end()
              })
            })
          })
        })
      })
    })

    await t.test(
      'query via execute() should be instrumented',
      { skip: lib === 'mysql' },
      function testTransaction(t, end) {
        const { agent, pool } = t.nr
        assert.ok(!agent.getTransaction(), 'no transaction should be in play yet')
        helper.runInTransaction(agent, function transactionInScope() {
          assert.ok(agent.getTransaction(), 'we should be in a transaction')

          getClient(pool, function (err, client) {
            assert.ok(!err)
            assert.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
            client.execute('SELECT 1', function (err) {
              assert.ok(!err)
              assert.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
              pool.release(client)
              agent.getTransaction().end()
              assert.ok(agent.queries.samples.size > 0, 'there should be a query sample')
              for (const sample of agent.queries.samples.values()) {
                assert.ok(sample.total > 0, 'the samples should have positive duration')
              }
              end()
            })
          })
        })
      }
    )

    await t.test('streaming query should be timed correctly', function testCB(t, end) {
      const { agent, pool } = t.nr
      assert.ok(!agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        assert.ok(agent.getTransaction(), 'we should be in a transaction')

        getClient(pool, function (err, client) {
          assert.ok(!err)
          assert.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          const query = client.query('SELECT SLEEP(1)', [])
          const start = Date.now()
          let duration = null
          let results = false
          let ended = false

          query.on('result', function () {
            results = true
          })

          query.on('error', function (err) {
            assert.ok(!err, 'streaming should not fail')
          })

          query.on('end', function () {
            duration = Date.now() - start
            ended = true
          })

          setTimeout(function actualEnd() {
            const transaction = agent.getTransaction().end()
            pool.release(client)
            assert.ok(results && ended, 'result and end events should occur')
            const traceRoot = transaction.trace.root
            const traceRootDuration = traceRoot.timer.getDurationInMillis()
            const segment = findSegment(transaction.trace, traceRoot, 'Datastore/statement/MySQL/unknown/select')
            const queryNodeDuration = segment.timer.getDurationInMillis()

            assert.ok(
              Math.abs(duration - queryNodeDuration) < 50,
              'query duration should be roughly be the time between query and end'
            )

            assert.ok(
              traceRootDuration - queryNodeDuration > 900,
              'query duration should be small compared to transaction duration'
            )

            end()
          }, 2000)
        })
      })
    })

    await t.test('streaming query children should nest correctly', function testCB(t, end) {
      const { agent, pool } = t.nr
      assert.ok(!agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        assert.ok(agent.getTransaction(), 'we should be in a transaction')

        getClient(pool, function (err, client) {
          assert.ok(!err)
          assert.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          const query = client.query('SELECT 1', [])

          query.on('result', function resultCallback() {
            setTimeout(function resultTimeout() {}, 10)
          })

          query.on('error', function errorCallback(err) {
            assert.ok(!err, 'streaming should not fail')
          })

          query.on('end', function endCallback() {
            setTimeout(function actualEnd() {
              const transaction = agent.getTransaction().end()
              pool.release(client)
              const traceRoot = transaction.trace.root
              const [querySegment] = transaction.trace.getChildren(traceRoot.id)
              const queryChildren = transaction.trace.getChildren(querySegment.id)
              assert.equal(
                queryChildren.length,
                2,
                'the query segment should have two children'
              )

              const childSegment = queryChildren[1]
              assert.equal(
                childSegment.name,
                'Callback: endCallback',
                'children should be callbacks'
              )
              const [grandChildSegment] = transaction.trace.getChildren(childSegment.id)
              assert.equal(
                grandChildSegment.name,
                'timers.setTimeout',
                'grand children should be timers'
              )
              end()
            }, 100)
          })
        })
      })
    })

    await t.test('query with options object rather than sql', function testCallbackOnly(t, end) {
      const { agent, pool } = t.nr
      assert.ok(!agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        assert.ok(agent.getTransaction(), 'we should be in a transaction')

        getClient(pool, function (err, client) {
          assert.ok(!err)
          assert.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          client.query({ sql: 'SELECT 1' }, function (err) {
            assert.ok(!err)
            assert.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
            pool.release(client)
            agent.getTransaction().end()
            assert.ok(agent.queries.samples.size > 0, 'there should be a query sample')
            for (const sample of agent.queries.samples.values()) {
              assert.ok(sample.total > 0, 'the samples should have positive duration')
            }
            end()
          })
        })
      })
    })

    await t.test('query with options object and values', function testCallbackOnly(t, end) {
      const { agent, pool } = t.nr
      assert.ok(!agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope() {
        assert.ok(agent.getTransaction(), 'we should be in a transaction')

        getClient(pool, function (err, client) {
          assert.ok(!err)
          assert.ok(agent.getTransaction(), 'generic-pool should not lose the transaction')
          client.query({ sql: 'SELECT 1' }, [], function (err) {
            assert.ok(!err)
            assert.ok(agent.getTransaction(), 'MySQL query should not lose the transaction')
            pool.release(client)
            agent.getTransaction().end()
            assert.ok(agent.queries.samples.size > 0, 'there should be a query sample')
            for (const sample of agent.queries.samples.values()) {
              assert.ok(sample.total > 0, 'the samples should have positive duration')
            }
            end()
          })
        })
      })
    })

    await t.test('ensure database name changes with a use statement', function (t, end) {
      const { agent, pool } = t.nr
      helper.runInTransaction(agent, function transactionInScope(txn) {
        getClient(pool, function (err, client) {
          assert.ok(!err)
          client.query('create database if not exists test_db;', function (err) {
            assert.ok(!err)
            client.query('use test_db;', function (err) {
              assert.ok(!err)
              client.query('SELECT 1 + 1 AS solution', function (err) {
                const seg = txn.trace.getParent(agent.tracer.getSegment().parentId)
                const attributes = seg.getAttributes()
                assert.ok(!err)
                assert.ok(seg, 'should have a segment')
                assert.equal(
                  attributes.host,
                  urltils.isLocalhost(params.mysql_host)
                    ? agent.config.getHostnameSafe()
                    : params.mysql_host,
                  'should set host parameter'
                )
                assert.equal(attributes.database_name, 'test_db', 'should use new database name')
                assert.equal(attributes.port_path_or_id, '3306', 'should set port parameter')
                client.query('drop test_db;', function () {
                  pool.release(client)
                  txn.end()
                  end()
                })
              })
            })
          })
        })
      })
    })
  })
}
