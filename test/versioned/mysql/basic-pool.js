/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('fs/promises')
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const params = require('../../lib/params')
const urltils = require('../../../lib/util/urltils')
const { exec } = require('child_process')
const setup = require('./setup')
const semver = require('semver')
const util = require('util')
const execAsync = util.promisify(exec)

module.exports = function ({ factory, constants, pkgVersion }) {
  const { USER, DATABASE, TABLE } = constants

  const config = getConfig({})
  function getConfig(extras) {
    const conf = {
      connectionLimit: 10,
      host: params.mysql_host,
      port: params.mysql_port,
      user: USER,
      database: DATABASE
    }

    for (const key in extras) {
      conf[key] = extras[key]
    }

    return conf
  }

  test('See if mysql is running', async function () {
    assert.doesNotThrow(async () => {
      await setup(USER, DATABASE, TABLE, factory())
    })
  })

  test('bad config', function (t, end) {
    const agent = helper.instrumentMockedAgent()
    t.after(function () {
      helper.unloadAgent(agent)
    })

    const mysql = factory()
    const badConfig = {
      connectionLimit: 10,
      host: 'nohost',
      user: USER,
      database: DATABASE
    }

    const poolCluster = mysql.createPoolCluster()

    poolCluster.add(badConfig) // anonymous group
    poolCluster.getConnection(function (err) {
      assert.ok(err, 'should throw an error')
      assert.ok(agent, 'agent does not crash')
      poolCluster.end()
      end()
    })
  })

  test('mysql built-in connection pools', async function (t) {
    t.beforeEach(async function (ctx) {
      await setup(USER, DATABASE, TABLE, factory())
      const agent = helper.instrumentMockedAgent()
      const mysql = factory()
      const pool = mysql.createPool(config)
      ctx.nr = {
        agent,
        mysql,
        pool
      }
    })

    t.afterEach(function (ctx) {
      const { pool, agent } = ctx.nr
      return new Promise((resolve) => {
        helper.unloadAgent(agent)
        pool.end(resolve)
      })
    })

    // make sure a connection exists in the pool before any tests are run
    // we want to make sure connections are allocated outside any transaction
    // this is to avoid tests that 'happen' to work because of how CLS works
    await t.test('primer', function (t, end) {
      const { agent, pool } = t.nr
      pool.query('SELECT 1 + 1 AS solution', function (err) {
        assert.ok(!err, 'are you sure mysql is running?')
        assert.ok(!agent.getTransaction(), 'transaction should not exist')
        end()
      })
    })

    await t.test('ensure host and port are set on segment', function (t, end) {
      const { agent, pool } = t.nr
      helper.runInTransaction(agent, function transactionInScope(txn) {
        pool.query('SELECT 1 + 1 AS solution', function (err) {
          assert.ok(!err, 'should not error')
          const [firstChild] = txn.trace.getChildren(txn.trace.root.id)
          assert.equal(firstChild?.name, 'MySQL Pool#query')
          const children = txn.trace.getChildren(firstChild.id)

          const [seg] = children.filter(function (trace) {
            return /Datastore\/statement\/MySQL/.test(trace.name)
          })

          assert.ok(seg, 'should have a segment (' + (seg && seg?.name) + ')')
          const attributes = seg.getAttributes()
          assert.equal(
            attributes.host,
            urltils.isLocalhost(config.host) ? agent.config.getHostnameSafe() : config.host,
            'set host'
          )
          assert.equal(attributes.database_name, DATABASE, 'set database name')
          assert.equal(attributes.port_path_or_id, String(config.port), 'set port')
          assert.equal(attributes.product, 'MySQL', 'set product attribute')
          txn.end()
          end()
        })
      })
    })

    await t.test('respects `datastore_tracer.instance_reporting`', function (t, end) {
      const { agent, pool } = t.nr
      helper.runInTransaction(agent, function transactionInScope(txn) {
        agent.config.datastore_tracer.instance_reporting.enabled = false
        pool.query('SELECT 1 + 1 AS solution', function (err) {
          assert.ok(!err, 'should not error making query')
          const seg = getDatastoreSegment({ trace: txn.trace, segment: agent.tracer.getSegment() })
          assert.ok(seg, 'should have a datastore segment')

          const attributes = seg.getAttributes()
          assert.ok(!attributes.host, 'should have no host parameter')
          assert.ok(!attributes.port_path_or_id, 'should have no port parameter')
          assert.equal(attributes.database_name, DATABASE, 'should set database name')
          assert.equal(attributes.product, 'MySQL', 'should set product attribute')
          agent.config.datastore_tracer.instance_reporting.enabled = true
          txn.end()
          end()
        })
      })
    })

    await t.test('respects `datastore_tracer.database_name_reporting`', function (t, end) {
      const { agent, pool } = t.nr
      helper.runInTransaction(agent, function transactionInScope(txn) {
        agent.config.datastore_tracer.database_name_reporting.enabled = false
        pool.query('SELECT 1 + 1 AS solution', function (err) {
          assert.ok(!err, 'no errors')
          const seg = getDatastoreSegment({ trace: txn.trace, segment: agent.tracer.getSegment() })
          assert.ok(seg, 'there is a datastore segment')
          const attributes = seg.getAttributes()
          assert.equal(
            attributes.host,
            urltils.isLocalhost(config.host) ? agent.config.getHostnameSafe() : config.host,
            'set host'
          )
          assert.equal(attributes.port_path_or_id, String(config.port), 'set port')
          assert.ok(!attributes.database_name, 'should have no database name parameter')
          assert.equal(attributes.product, 'MySQL', 'should set product attribute')
          agent.config.datastore_tracer.database_name_reporting.enabled = true
          txn.end()
          end()
        })
      })
    })

    await t.test('ensure host is the default (localhost) when not supplied', function (t, end) {
      const { agent, mysql } = t.nr
      const defaultConfig = getConfig({
        host: null
      })
      const defaultPool = mysql.createPool(defaultConfig)
      helper.runInTransaction(agent, function transactionInScope(txn) {
        defaultPool.query('SELECT 1 + 1 AS solution', function (err) {
          assert.ok(!err, 'should not fail to execute query')

          // In the case where you don't have a server running on
          // localhost the data will still be correctly associated
          // with the query.
          const seg = getDatastoreSegment({ trace: txn.trace, segment: agent.tracer.getSegment() })
          assert.ok(seg, 'there is a datastore segment')
          const attributes = seg.getAttributes()
          assert.equal(attributes.host, agent.config.getHostnameSafe(), 'set host')
          assert.equal(attributes.database_name, DATABASE, 'set database name')
          assert.equal(attributes.port_path_or_id, String(defaultConfig.port), 'set port')
          assert.equal(attributes.product, 'MySQL', 'should set product attribute')
          txn.end()
          defaultPool.end(end)
        })
      })
    })

    await t.test('ensure port is the default (3306) when not supplied', function (t, end) {
      const { agent, mysql } = t.nr
      const defaultConfig = getConfig({
        host: null
      })
      const defaultPool = mysql.createPool(defaultConfig)
      helper.runInTransaction(agent, function transactionInScope(txn) {
        defaultPool.query('SELECT 1 + 1 AS solution', function (err) {
          assert.ok(!err, 'should not error making query')
          const seg = getDatastoreSegment({ trace: txn.trace, segment: agent.tracer.getSegment() })
          assert.ok(seg, 'there is a datastore segment')
          const attributes = seg.getAttributes()

          assert.equal(
            attributes.host,
            urltils.isLocalhost(config.host) ? agent.config.getHostnameSafe() : config.host,
            'should set host'
          )
          assert.equal(attributes.database_name, DATABASE, 'should set database name')
          assert.equal(attributes.port_path_or_id, '3306', 'should set port')
          assert.equal(attributes.product, 'MySQL', 'should set product attribute')
          txn.end()
          defaultPool.end(end())
        })
      })
    })

    await t.test('query with error', function (t, end) {
      const { agent, pool } = t.nr
      helper.runInTransaction(agent, function transactionInScope(txn) {
        pool.query('BLARG', function (err) {
          assert.ok(err)
          assert.ok(agent.getTransaction(), 'transaction should exit')
          txn.end()
          end()
        })
      })
    })

    await t.test('lack of callback does not explode', function (t, end) {
      const { agent, pool } = t.nr
      helper.runInTransaction(agent, function transactionInScope(txn) {
        pool.query('SET SESSION auto_increment_increment=1')
        setTimeout(() => {
          txn.end()
          end()
        }, 500)
      })
    })

    await t.test('pool.query', function (t, end) {
      const { agent, pool } = t.nr
      helper.runInTransaction(agent, function transactionInScope(txn) {
        pool.query('SELECT 1 + 1 AS solution123123123123', function (err) {
          assert.ok(!err, 'no error occurred')
          const transaction = agent.getTransaction()
          assert.ok(transaction, 'transaction should exist')
          const segment = txn.trace.getParent(agent.tracer.getSegment().id)

          assert.ok(segment, 'segment should exist')
          assert.ok(segment.timer.start > 0, 'starts at a positive time')
          assert.ok(segment.timer.start <= Date.now(), 'starts in past')
          assert.equal(segment.name, 'MySQL Pool#query', 'is named')
          txn.end()
          end()
        })
      })
    })

    await t.test('pool.query with values', function (t, end) {
      const { agent, pool } = t.nr
      helper.runInTransaction(agent, function transactionInScope(txn) {
        pool.query('SELECT ? + ? AS solution', [1, 1], function (err) {
          assert.ok(!err)
          const transaction = agent.getTransaction()
          assert.ok(transaction, 'should not lose transaction')
          if (transaction) {
            const segment = txn.trace.getParent(agent.tracer.getSegment().id)
            assert.ok(segment, 'segment should exist')
            assert.ok(segment.timer.start > 0, 'starts at a positive time')
            assert.ok(segment.timer.start <= Date.now(), 'starts in past')
            assert.equal(segment.name, 'MySQL Pool#query', 'is named')
          }

          txn.end()
          end()
        })
      })
    })

    await t.test('pool.getConnection -> connection.query', function (t, end) {
      const { agent, pool } = t.nr
      helper.runInTransaction(agent, function transactionInScope(txn) {
        pool.getConnection(function shouldBeWrapped(err, connection) {
          assert.ok(!err, 'should not have error')
          assert.ok(agent.getTransaction(), 'transaction should exit')
          t.after(function () {
            connection.release()
          })

          connection.query('SELECT 1 + 1 AS solution', function (err) {
            const transaction = agent.getTransaction()
            const segment = txn.trace.getParent(agent.tracer.getSegment().id)

            assert.ok(!err, 'no error occurred')
            assert.ok(transaction, 'transaction should exist')
            assert.ok(segment, 'segment should exist')
            assert.ok(segment.timer.start > 0, 'starts at a positive time')
            assert.ok(segment.timer.start <= Date.now(), 'starts in past')
            assert.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            txn.end()
            end()
          })
        })
      })
    })

    await t.test('pool.getConnection -> connection.query with values', function (t, end) {
      const { agent, pool } = t.nr
      helper.runInTransaction(agent, function transactionInScope(txn) {
        pool.getConnection(function shouldBeWrapped(err, connection) {
          assert.ok(!err, 'should not have error')
          assert.ok(agent.getTransaction(), 'transaction should exit')
          t.after(function () {
            connection.release()
          })

          connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
            assert.ok(!err)
            const transaction = agent.getTransaction()
            assert.ok(transaction, 'should not lose transaction')
            if (transaction) {
              const segment = txn.trace.getParent(agent.tracer.getSegment().id)
              assert.ok(segment, 'segment should exist')
              assert.ok(segment.timer.start > 0, 'starts at a positive time')
              assert.ok(segment.timer.start <= Date.now(), 'starts in past')
              assert.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            }

            txn.end()
            end()
          })
        })
      })
    })

    const socketPath = await getDomainSocketPath()
    await t.test(
      'ensure host and port are set on segment when using a domain socket',
      { skip: !socketPath },
      function (t, end) {
        const { agent, mysql } = t.nr
        const socketConfig = getConfig({
          socketPath
        })
        const socketPool = mysql.createPool(socketConfig)
        helper.runInTransaction(agent, function transactionInScope(txn) {
          socketPool.query('SELECT 1 + 1 AS solution', function (err) {
            assert.ok(!err, 'should not error making query')

            const seg = getDatastoreSegment({
              trace: txn.trace,
              segment: agent.tracer.getSegment()
            })
            const attributes = seg.getAttributes()

            // In the case where you don't have a server running on localhost
            // the data will still be correctly associated with the query.
            assert.ok(seg, 'there is a segment')
            assert.equal(attributes.host, agent.config.getHostnameSafe(), 'set host')
            assert.equal(attributes.port_path_or_id, socketPath, 'set path')
            assert.equal(attributes.database_name, DATABASE, 'set database name')
            assert.equal(attributes.product, 'MySQL', 'should set product attribute')
            txn.end()
            socketPool.end(end)
          })
        })
      }
    )

    await t.test('query with options streaming should work', function testCallbackOnly(t, end) {
      const { agent, pool } = t.nr
      assert.ok(!agent.getTransaction(), 'no transaction should be in play yet')
      helper.runInTransaction(agent, function transactionInScope(txn) {
        assert.ok(agent.getTransaction(), 'we should be in a transaction')

        const query = pool.query('SELECT 1', [])
        let results = false

        query.on('result', function () {
          results = true
        })

        query.on('error', function (err) {
          assert.fail(`pool.query streaming should not fail: ${err.message}`)
        })

        query.on('end', function () {
          const transaction = agent.getTransaction()
          const segment = txn.trace.getParent(agent.tracer.getSegment().id)

          assert.ok(results, 'stream result should be received')
          assert.ok(transaction, 'transaction should exist')
          assert.ok(segment, 'segment should exist')
          assert.ok(segment.timer.start > 0, 'starts at a positive time')
          assert.ok(segment.timer.start <= Date.now(), 'starts in past')
          assert.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
          txn.end()
          end()
        })
      })
    })
  })

  test('poolCluster', async function (t) {
    t.beforeEach(async function (ctx) {
      await setup(USER, DATABASE, TABLE, factory())
      const agent = helper.instrumentMockedAgent()
      const mysql = factory()
      const poolCluster = mysql.createPoolCluster()

      poolCluster.add(config) // anonymous group
      poolCluster.add('MASTER', config)
      poolCluster.add('REPLICA', config)
      ctx.nr = {
        agent,
        mysql,
        poolCluster
      }
    })

    t.afterEach(function (ctx) {
      const { agent, poolCluster } = ctx.nr
      poolCluster.end()
      helper.unloadAgent(agent)
    })

    await t.test('without transaction', function (t, end) {
      const { agent, poolCluster } = t.nr
      poolCluster.getConnection(function (err, connection) {
        assert.ok(!err, 'should not be an error')
        assert.ok(!agent.getTransaction(), 'transaction should not exist')

        connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
          assert.ok(!err)
          assert.ok(!agent.getTransaction(), 'transaction should not exist')

          connection.release()
          end()
        })
      })
    })

    await t.test('get any connection -> connection.query', function (t, end) {
      const { agent, poolCluster } = t.nr
      helper.runInTransaction(agent, function (txn) {
        poolCluster.getConnection(function (err, connection) {
          assert.ok(!err, 'should not have error')
          assert.ok(agent.getTransaction(), 'transaction should exist')
          assert.equal(agent.getTransaction(), txn, 'transaction must be original')

          connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
            assert.ok(!err, 'no error occurred')
            const transaction = agent.getTransaction()
            assert.ok(transaction, 'transaction should exist')
            assert.equal(transaction.id, txn.id, 'transaction must be same')
            const segment = txn.trace.getParent(agent.tracer.getSegment().id)
            assert.ok(segment, 'segment should exist')
            assert.ok(segment.timer.start > 0, 'starts at a positive time')
            assert.ok(segment.timer.start <= Date.now(), 'starts in past')
            assert.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

            txn.end()
            connection.release()
            end()
          })
        })
      })
    })

    await t.test('get MASTER connection -> connection.query', function (t, end) {
      const { agent, poolCluster } = t.nr
      helper.runInTransaction(agent, function (txn) {
        poolCluster.getConnection('MASTER', function (err, connection) {
          assert.ifError(err)
          assert.ok(agent.getTransaction())
          assert.equal(agent.getTransaction(), txn)

          connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
            assert.ok(!err, 'no error occurred')
            const transaction = agent.getTransaction()
            assert.ok(transaction, 'transaction should exist')
            assert.equal(transaction.id, txn.id, 'transaction must be same')
            const segment = txn.trace.getParent(agent.tracer.getSegment().id)
            assert.ok(segment, 'segment should exist')
            assert.ok(segment.timer.start > 0, 'starts at a positive time')
            assert.ok(segment.timer.start <= Date.now(), 'starts in past')
            assert.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

            txn.end()
            connection.release()
            end()
          })
        })
      })
    })

    await t.test('get glob -> connection.query', function (t, end) {
      const { agent, poolCluster } = t.nr
      helper.runInTransaction(agent, function (txn) {
        poolCluster.getConnection('REPLICA*', 'ORDER', function (err, connection) {
          assert.ifError(err)
          assert.ok(agent.getTransaction())
          assert.equal(agent.getTransaction(), txn)

          connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
            assert.ok(!err, 'no error occurred')
            const transaction = agent.getTransaction()
            assert.ok(transaction, 'transaction should exist')
            assert.equal(transaction.id, txn.id, 'transaction must be same')
            const segment = txn.trace.getParent(agent.tracer.getSegment().id)
            assert.ok(segment, 'segment should exist')
            assert.ok(segment.timer.start > 0, 'starts at a positive time')
            assert.ok(segment.timer.start <= Date.now(), 'starts in past')
            assert.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

            txn.end()
            connection.release()
            end()
          })
        })
      })
    })

    await t.test('get star -> connection.query', function (t, end) {
      const { agent, poolCluster } = t.nr
      helper.runInTransaction(agent, function (txn) {
        poolCluster.of('*').getConnection(function (err, connection) {
          assert.ifError(err)
          assert.ok(agent.getTransaction(), 'transaction should exist')

          connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
            assert.ok(!err, 'no error occurred')
            const transaction = agent.getTransaction()
            assert.ok(transaction, 'transaction should exist')
            assert.equal(transaction.id, txn.id, 'transaction must be same')
            const segment = txn.trace.getParent(agent.tracer.getSegment().id)
            assert.ok(segment, 'segment should exist')
            assert.ok(segment.timer.start > 0, 'starts at a positive time')
            assert.ok(segment.timer.start <= Date.now(), 'starts in past')
            assert.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

            txn.end()
            connection.release()
            end()
          })
        })
      })
    })

    await t.test('get wildcard -> connection.query', function (t, end) {
      const { agent, poolCluster } = t.nr
      helper.runInTransaction(agent, function (txn) {
        const pool = poolCluster.of('REPLICA*', 'RANDOM')
        pool.getConnection(function (err, connection) {
          assert.ifError(err)
          assert.ok(agent.getTransaction(), 'transaction should exist')

          connection.query('SELECT ? + ? AS solution', [1, 1], function (err) {
            assert.ok(!err, 'no error occurred')
            const currentTransaction = agent.getTransaction()
            assert.ok(currentTransaction, 'transaction should exist')
            assert.equal(currentTransaction.id, txn.id, 'transaction must be same')
            const segment = txn.trace.getParent(agent.tracer.getSegment().id)
            assert.ok(segment, 'segment should exist')
            assert.ok(segment.timer.start > 0, 'starts at a positive time')
            assert.ok(segment.timer.start <= Date.now(), 'starts in past')
            assert.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

            txn.end()
            connection.release()
            end()
          })
        })
      })
    })

    // not added until 2.12.0
    // https://github.com/mysqljs/mysql/blob/master/Changes.md#v2120-2016-11-02
    if (semver.satisfies(pkgVersion, '>=2.12.0')) {
      await t.test('poolCluster query, callback', function (t, end) {
        const { agent, poolCluster } = t.nr
        const masterPool = poolCluster.of('MASTER', 'RANDOM')
        const replicaPool = poolCluster.of('REPLICA', 'RANDOM')
        helper.runInTransaction(agent, function (txn) {
          replicaPool.query('SELECT ? + ? AS solution', [1, 1], function (err) {
            assert.ok(!err, 'no error occurred')
            let transaction = agent.getTransaction()
            assert.ok(transaction, 'transaction should exist')
            assert.equal(transaction, txn, 'transaction must be same')

            // We should be in a 'MySQL Pool#query' segment.
            // It should have a 'Datastore/statement/MySQL/unknown/select' child.
            const activeSegment = agent.tracer.getSegment()
            assert.ok(activeSegment)
            assert.equal(activeSegment.name, 'MySQL Pool#query', 'is named')
            const segment = getDatastoreSegment({ segment: agent.tracer.getSegment(), trace: txn.trace })
            assert.ok(segment, 'Datastore segment should exist')
            assert.ok(segment.timer.start > 0, 'starts at a positive time')
            assert.ok(segment.timer.start <= Date.now(), 'starts in past')
            assert.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

            masterPool.query('SELECT ? + ? AS solution', [1, 1], function (err) {
              assert.ok(!err, 'no error occurred')
              transaction = agent.getTransaction()
              assert.ok(transaction, 'transaction should exist')
              assert.equal(transaction, txn, 'transaction must be same')

              // We should be in a 'MySQL Pool#query' segment.
              // It should have a 'Datastore/statement/MySQL/unknown/select' child.
              const activeSegment = agent.tracer.getSegment()
              assert.ok(activeSegment)
              assert.equal(activeSegment.name, 'MySQL Pool#query', 'is named')
              const segment = getDatastoreSegment({ segment: agent.tracer.getSegment(), trace: txn.trace })
              assert.ok(segment, 'segment should exist')
              assert.ok(segment.timer.start > 0, 'starts at a positive time')
              assert.ok(segment.timer.start <= Date.now(), 'starts in past')
              assert.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')

              txn.end()
              end()
            })
          })
        })
      })

      await t.test('poolCluster query, streaming', function(t, end) {
        const { agent, poolCluster } = t.nr
        const masterPool = poolCluster.of('MASTER', 'RANDOM')
        const replicaPool = poolCluster.of('REPLICA', 'RANDOM')

        helper.runInTransaction(agent, function (txn) {
          let replicaResults = false
          const replicaQuery = replicaPool.query('SELECT ? + ? AS solution', [1, 1])

          replicaQuery.on('result', function () {
            replicaResults = true
          })

          replicaQuery.on('error', function (err) {
            assert.fail(`replicaPool.query streaming should not fail: ${err.message}`)
          })

          replicaQuery.on('end', function () {
            let transaction = agent.getTransaction()
            assert.ok(transaction, 'transaction should exist')
            assert.equal(transaction, txn, 'transaction must be same')

            const segment = agent.tracer.getSegment()
            assert.ok(segment, 'Datastore segment should exist')
            assert.ok(segment.timer.start > 0, 'starts at a positive time')
            assert.ok(segment.timer.start <= Date.now(), 'starts in past')
            assert.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
            assert.ok(replicaResults, 'replica stream result should be received')

            // Now test master pool
            let masterResults = false
            const masterQuery = masterPool.query('SELECT ? + ? AS solution', [1, 1])

            masterQuery.on('result', function () {
              masterResults = true
            })

            masterQuery.on('error', function (err) {
              assert.fail(`masterPool.query streaming should not fail: ${err.message}`)
            })

            masterQuery.on('end', function () {
              transaction = agent.getTransaction()
              assert.ok(transaction, 'transaction should exist')
              assert.equal(transaction, txn, 'transaction must be same')

              const segment = agent.tracer.getSegment()
              assert.ok(segment, 'segment should exist')
              assert.ok(segment.timer.start > 0, 'starts at a positive time')
              assert.ok(segment.timer.start <= Date.now(), 'starts in past')
              assert.equal(segment.name, 'Datastore/statement/MySQL/unknown/select', 'is named')
              assert.ok(masterResults, 'master stream result should be received')

              txn.end()
              end()
            })
          })
        })
      })
    }
  })
}

async function getDomainSocketPath() {
  try {
    const { stdout, stderr } = await execAsync('mysql_config --socket')
    if (stderr.toString()) {
      return false
    }

    const sock = stdout.toString().trim()
    await fs.access(sock)
    return sock
  } catch {
    return false
  }
}

/**
 *
 * @param {object} parameters parameters object
 * @param {object} parameters.segment the segment that should be the parent of the Datastore segment
 * @param {object} parameters.trace the trace associated with the segments
 * @returns {object|null} the found Datastore segment or null if not found
 */
function getDatastoreSegment({ segment, trace }) {
  return trace.getChildren(segment.id).filter(function (s) {
    return /^Datastore/.test(s && s.name)
  })[0]
}
