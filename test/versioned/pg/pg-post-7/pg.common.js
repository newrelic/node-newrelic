/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const a = require('async')
const tap = require('tap')
const params = require('../../../lib/params')
const helper = require('../../../lib/agent_helper')
const findSegment = require('../../../lib/metrics_helper').findSegment
const test = tap.test
const getMetricHostName = require('../../../lib/metrics_helper').getMetricHostName

module.exports = function runTests(name, clientFactory) {
  // constants for table creation and db connection
  const TABLE = 'testTable-post'
  const TABLE_PREPARED = '"' + TABLE + '"'
  const PK = 'pk_column'
  const COL = 'test_column'
  const CON_OBJ = {
    user: params.postgres_user,
    password: params.postgres_pass,
    host: params.postgres_host,
    port: params.postgres_port,
    database: params.postgres_db
  }

  /**
   * Deletion of testing table if already exists,
   * then recreation of a testing table
   */
  function postgresSetup() {
    const pg = clientFactory()
    const setupClient = new pg.Client(CON_OBJ)

    return new Promise((resolve, reject) => {
      setupClient.connect(function (err) {
        if (err) {
          reject(err)
        }
        const tableDrop = 'DROP TABLE IF EXISTS ' + TABLE_PREPARED

        const tableCreate =
          'CREATE TABLE ' +
          TABLE_PREPARED +
          ' (' +
          PK +
          ' integer PRIMARY KEY, ' +
          COL +
          ' text' +
          ');'

        a.eachSeries(
          [
            "set client_min_messages='warning';", // supress PG notices
            tableDrop,
            tableCreate
          ],
          function (query, cb) {
            setupClient.query(query, cb)
          },
          function (err) {
            if (err) {
              reject(err)
            }
            setupClient.end()
            resolve()
          }
        )
      })
    })
  }

  function verify(t, segment, selectTable) {
    verifyMetrics(t, segment, selectTable)
    verifyTrace(t, segment, selectTable)
    verifyInstanceParameters(t, segment)
  }

  function verifyMetrics(t, segment, selectTable) {
    const transaction = segment.transaction
    const agent = transaction.agent
    selectTable = selectTable || TABLE
    t.equal(Object.keys(transaction.metrics.scoped).length, 0, 'should not have any scoped metrics')

    const unscoped = transaction.metrics.unscoped

    const expected = {
      'Datastore/all': 2,
      'Datastore/allWeb': 2,
      'Datastore/Postgres/all': 2,
      'Datastore/Postgres/allWeb': 2,
      'Datastore/operation/Postgres/insert': 1,
      'Datastore/operation/Postgres/select': 1
    }

    expected['Datastore/statement/Postgres/' + TABLE + '/insert'] = 1
    expected['Datastore/statement/Postgres/' + selectTable + '/select'] = 1

    const metricHostName = getMetricHostName(agent, params.postgres_host)
    const hostId = metricHostName + '/' + params.postgres_port
    expected['Datastore/instance/Postgres/' + hostId] = 2

    const expectedNames = Object.keys(expected)
    const unscopedNames = Object.keys(unscoped)

    expectedNames.forEach(function (expectedName) {
      t.ok(unscoped[expectedName], 'should have unscoped metric ' + expectedName)
      if (unscoped[expectedName]) {
        t.equal(
          unscoped[expectedName].callCount,
          expected[expectedName],
          'metric ' + expectedName + ' should have correct callCount'
        )
      }
    })

    t.equal(
      unscopedNames.length,
      expectedNames.length,
      'should have correct number of unscoped metrics'
    )
  }

  function verifyTrace(t, segment, selectTable) {
    const transaction = segment.transaction
    selectTable = selectTable || TABLE
    const trace = transaction.trace

    t.ok(trace, 'trace should exist')
    t.ok(trace.root, 'root element should exist')

    const setSegment = findSegment(trace.root, 'Datastore/statement/Postgres/' + TABLE + '/insert')

    const getSegment = findSegment(
      trace.root,
      'Datastore/statement/Postgres/' + selectTable + '/select'
    )

    t.ok(setSegment, 'trace segment for insert should exist')
    t.ok(getSegment, 'trace segment for select should exist')

    if (!getSegment) {
      return
    }

    t.equal(
      getSegment.name,
      'Datastore/statement/Postgres/' + selectTable + '/select',
      'should register the query call'
    )

    t.ok(getSegment.timer.hrDuration, 'trace segment should have ended')
  }

  function verifyInstanceParameters(t, segment) {
    const transaction = segment.transaction
    const agent = transaction.agent
    const trace = transaction.trace

    const setSegment = findSegment(trace.root, 'Datastore/statement/Postgres/' + TABLE + '/insert')
    const attributes = setSegment.getAttributes()

    const metricHostName = getMetricHostName(agent, params.postgres_host)
    t.equal(attributes.host, metricHostName, 'should add the host parameter')
    t.equal(
      attributes.port_path_or_id,
      String(params.postgres_port),
      'should add the port parameter'
    )
    t.equal(attributes.database_name, params.postgres_db, 'should add the database name parameter')
    t.equal(attributes.product, 'Postgres', 'should add the product attribute')
  }

  function verifySlowQueries(t, agent) {
    const metricHostName = getMetricHostName(agent, params.postgres_host)

    t.equal(agent.queries.samples.size, 1, 'should have one slow query')
    for (const sample of agent.queries.samples.values()) {
      const queryParams = sample.getParams()

      t.equal(queryParams.host, metricHostName, 'instance data should show up in slow query params')

      t.equal(
        queryParams.port_path_or_id,
        String(params.postgres_port),
        'instance data should show up in slow query params'
      )

      t.equal(
        queryParams.database_name,
        params.postgres_db,
        'database name should show up in slow query params'
      )

      t.ok(queryParams.backtrace, 'params should contain a backtrace')
    }
  }

  test('Postgres instrumentation: ' + name, function (t) {
    t.autoend()

    let agent = null
    let pg = null

    t.beforeEach(function () {
      // the pg module has `native` lazy getter that is removed after first call,
      // so in order to re-instrument, we need to remove the pg module from the cache
      const pgName = require.resolve('pg')
      delete require.cache[pgName]

      agent = helper.instrumentMockedAgent()
      pg = clientFactory()

      return postgresSetup()
    })

    t.afterEach(function () {
      helper.unloadAgent(agent)
      agent = null
      pg = null
    })

    t.test('simple query with prepared statement', function (t) {
      const client = new pg.Client(CON_OBJ)

      t.teardown(function () {
        client.end()
      })

      t.notOk(agent.getTransaction(), 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        const colVal = 'Hello'
        const pkVal = 111
        let insQuery = 'INSERT INTO ' + TABLE_PREPARED + ' (' + PK + ',' + COL
        insQuery += ') VALUES($1, $2);'

        client.connect(function (error) {
          if (!t.error(error)) {
            return t.end()
          }

          client.query(insQuery, [pkVal, colVal], function (error, ok) {
            if (!t.error(error)) {
              return t.end()
            }

            t.ok(agent.getTransaction(), 'transaction should still be visible')
            t.ok(ok, 'everything should be peachy after setting')

            let selQuery = 'SELECT * FROM ' + TABLE_PREPARED + ' WHERE '
            selQuery += PK + '=' + pkVal + ';'

            client.query(selQuery, function (error, value) {
              if (!t.error(error)) {
                return t.end()
              }

              t.ok(agent.getTransaction(), 'transaction should still still be visible')
              t.equal(value.rows[0][COL], colVal, 'Postgres client should still work')

              transaction.end()
              verify(t, agent.tracer.getSegment())
              t.end()
            })
          })
        })
      })
    })

    t.test('Promise style query', function (t) {
      const client = new pg.Client(CON_OBJ)

      t.teardown(function () {
        client.end()
      })

      helper.runInTransaction(agent, async function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        const colVal = 'Hello'
        const pkVal = 111
        let insQuery = 'INSERT INTO ' + TABLE_PREPARED + ' (' + PK + ',' + COL
        insQuery += ') VALUES($1, $2);'

        try {
          await client.connect()
        } catch (err) {
          t.error(err)
        }

        try {
          const results = await client.query(insQuery, [pkVal, colVal])

          t.ok(agent.getTransaction(), 'transaction should still be visible')
          t.ok(results, 'everything should be peachy after setting')

          let selQuery = 'SELECT * FROM ' + TABLE_PREPARED + ' WHERE '
          selQuery += PK + '=' + pkVal + ';'

          const selectResults = await client.query(selQuery)

          t.ok(agent.getTransaction(), 'transaction should still still be visible')
          t.equal(selectResults.rows[0][COL], colVal, 'Postgres client should still work')
          transaction.end()
          verify(t, agent.tracer.getSegment())
          t.end()
        } catch (err) {
          t.error(err)
          t.end()
        }
      })
    })

    t.test('Submittable style Query timings', function (t) {
      // see bottom of this page https://node-postgres.com/guides/upgrading
      const client = new pg.Client(CON_OBJ)

      t.teardown(function () {
        client.end()
      })

      t.notOk(agent.getTransaction(), 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        const selQuery = 'SELECT pg_sleep(2), now() as sleep;'

        client.connect(function (error) {
          if (!t.error(error)) {
            return t.end()
          }

          const pgQuery = client.query(new pg.Query(selQuery))

          pgQuery.on('error', () => {
            t.error(error)
            t.end()
          })

          pgQuery.on('end', () => {
            t.ok(agent.getTransaction(), 'transaction should still be visible')

            transaction.end()

            const segment = agent.tracer.getSegment()

            const finalTx = segment.transaction

            const metrics = finalTx.metrics.getMetric('Datastore/operation/Postgres/select')

            t.ok(
              metrics.total > 2.0,
              'Submittable style Query pg_sleep of 2 seconds should result in > 2 sec timing'
            )

            t.end()
          })
        })
      })
    })

    t.test('Promise style query timings', function (t) {
      const client = new pg.Client(CON_OBJ)

      t.teardown(function () {
        client.end()
      })

      helper.runInTransaction(agent, async function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        try {
          await client.connect()
        } catch (err) {
          t.error(err)
        }

        try {
          const selQuery = 'SELECT pg_sleep(2), now() as sleep;'

          const selectResults = await client.query(selQuery)

          t.ok(agent.getTransaction(), 'transaction should still still be visible')
          t.ok(selectResults, 'Postgres client should still work')
          transaction.end()
          const segment = agent.tracer.getSegment()

          const finalTx = segment.transaction

          const metrics = finalTx.metrics.getMetric('Datastore/operation/Postgres/select')

          t.ok(
            metrics.total > 2.0,
            'Promise style query pg_sleep of 2 seconds should result in > 2 sec timing'
          )

          t.end()
        } catch (err) {
          t.error(err)
          t.end()
        }
      })
    })

    t.test('Callback style query timings', function (t) {
      const client = new pg.Client(CON_OBJ)

      t.teardown(function () {
        client.end()
      })

      helper.runInTransaction(agent, async function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        client.connect(function (error) {
          if (!t.error(error)) {
            return t.end()
          }

          const selQuery = 'SELECT pg_sleep(2), now() as sleep;'

          client.query(selQuery, function (error, ok) {
            if (!t.error(error)) {
              return t.end()
            }

            t.ok(agent.getTransaction(), 'transaction should still be visible')
            t.ok(ok, 'everything should be peachy after setting')

            transaction.end()
            const segment = agent.tracer.getSegment()

            const finalTx = segment.transaction

            const metrics = finalTx.metrics.getMetric('Datastore/operation/Postgres/select')

            t.ok(
              metrics.total > 2.0,
              'Callback style query pg_sleep of 2 seconds should result in > 2 sec timing'
            )

            t.end()
          })
        })
      })
    })

    t.test('client pooling query', function (t) {
      t.plan(39)
      t.notOk(agent.getTransaction(), 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        const colVal = 'World!'
        const pkVal = 222
        let insQuery = 'INSERT INTO ' + TABLE_PREPARED + ' (' + PK + ',' + COL
        insQuery += ') VALUES(' + pkVal + ",'" + colVal + "');"
        const pool = new pg.Pool(CON_OBJ)
        pool.query(insQuery, function (error, ok) {
          if (!t.error(error)) {
            return t.end()
          }

          t.ok(agent.getTransaction(), 'transaction should still be visible')
          t.ok(ok, 'everything should be peachy after setting')

          let selQuery = 'SELECT * FROM ' + TABLE_PREPARED + ' WHERE '
          selQuery += PK + '=' + pkVal + ';'

          pool.query(selQuery, function (error, value) {
            if (!t.error(error)) {
              return t.end()
            }

            t.ok(agent.getTransaction(), 'transaction should still still be visible')
            t.equal(value.rows[0][COL], colVal, 'Postgres client should still work')

            transaction.end()
            pool.end()
            verify(t, agent.tracer.getSegment())
          })
        })
      })
    })

    t.test('using Pool constructor', function (t) {
      t.plan(40)

      t.notOk(agent.getTransaction(), 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        const colVal = 'World!'
        const pkVal = 222
        let insQuery = 'INSERT INTO ' + TABLE_PREPARED + ' (' + PK + ',' + COL
        insQuery += ') VALUES(' + pkVal + ",'" + colVal + "');"

        let pool = null
        if (pg.Pool) {
          pool = new pg.Pool(CON_OBJ)
        } else {
          pool = pg.pools.getOrCreate(CON_OBJ)
        }

        pool.connect(function (error, client, done) {
          if (!t.error(error)) {
            return t.end()
          }

          client.query(insQuery, function (error, ok) {
            if (!t.error(error)) {
              return t.end()
            }

            t.ok(agent.getTransaction(), 'transaction should still be visible')
            t.ok(ok, 'everything should be peachy after setting')

            let selQuery = 'SELECT * FROM ' + TABLE_PREPARED + ' WHERE '
            selQuery += PK + '=' + pkVal + ';'

            client.query(selQuery, function (error, value) {
              if (!t.error(error)) {
                return t.end()
              }

              t.ok(agent.getTransaction(), 'transaction should still still be visible')
              t.equal(value.rows[0][COL], colVal, 'Postgres client should still work')

              transaction.end()
              if (pool.end instanceof Function) {
                pool.end()
              }

              done(true)
              verify(t, agent.tracer.getSegment())
            })
          })
        })
      })
    })

    // https://github.com/newrelic/node-newrelic/pull/223
    t.test('query using an config object with `text` getter instead of property', (t) => {
      t.plan(3)
      const client = new pg.Client(CON_OBJ)

      t.teardown(function () {
        client.end()
      })

      helper.runInTransaction(agent, function () {
        const transaction = agent.getTransaction()

        const colVal = 'Sianara'
        const pkVal = 444

        function CustomConfigClass() {
          this._text = 'INSERT INTO ' + TABLE_PREPARED + ' (' + PK + ',' + COL
          this._text += ') VALUES($1, $2);'
        }

        // "text" is defined as a getter on the prototype, so it will not be
        // a property owned by the instance
        Object.defineProperty(CustomConfigClass.prototype, 'text', {
          get: function () {
            return this._text
          }
        })

        // create a config instance
        const config = new CustomConfigClass()

        client.connect(function (error) {
          if (!t.error(error)) {
            return t.end()
          }

          client.query(config, [pkVal, colVal], function (error) {
            if (!t.error(error)) {
              return t.end()
            }

            const segment = findSegment(
              transaction.trace.root,
              'Datastore/statement/Postgres/' + TABLE + '/insert'
            )
            t.ok(segment, 'expected segment exists')
          })
        })
      })
    })

    t.test('should add datastore instance parameters to slow query traces', function (t) {
      t.plan(7)
      // enable slow queries
      agent.config.transaction_tracer.record_sql = 'raw'
      agent.config.slow_sql.enabled = true

      const client = new pg.Client(CON_OBJ)

      t.teardown(function () {
        client.end()
      })

      helper.runInTransaction(agent, function () {
        const transaction = agent.getTransaction()
        client.connect(function (error) {
          if (!t.error(error)) {
            return t.end()
          }

          client.query('SELECT * FROM pg_sleep(1);', function slowQueryCB(error) {
            if (!t.error(error)) {
              return t.end()
            }

            transaction.end()
            verifySlowQueries(t, agent)
            t.end()
          })
        })
      })
    })

    t.test(
      'should not add datastore instance parameters to slow query traces when' + ' disabled',
      function (t) {
        t.plan(5)

        // enable slow queries
        agent.config.transaction_tracer.record_sql = 'raw'
        agent.config.slow_sql.enabled = true

        // disable datastore instance
        agent.config.datastore_tracer.instance_reporting.enabled = false
        agent.config.datastore_tracer.database_name_reporting.enabled = false

        const client = new pg.Client(CON_OBJ)

        t.teardown(function () {
          client.end()
        })

        helper.runInTransaction(agent, function () {
          const transaction = agent.getTransaction()
          client.connect(function (error) {
            if (!t.error(error)) {
              return t.end()
            }

            client.query('SELECT * FROM pg_sleep(1);', function (error) {
              if (!t.error(error)) {
                return t.end()
              }

              transaction.end()
              const queryParams = agent.queries.samples.values().next().value

              t.equal(queryParams.host, undefined, 'should not have host parameter')

              t.equal(queryParams.port_path_or_id, undefined, 'should not have port parameter')

              t.equal(
                queryParams.database_name,
                undefined,
                'should not have database name parameter'
              )
            })
          })
        })
      }
    )
  })
}
