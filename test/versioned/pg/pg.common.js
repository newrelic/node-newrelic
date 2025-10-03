/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const tspl = require('@matteo.collina/tspl')

const params = require('../../lib/params')
const helper = require('../../lib/agent_helper')
const findSegment = require('../../lib/metrics_helper').findSegment
const getMetricHostName = require('../../lib/metrics_helper').getMetricHostName
const { assertPackageMetrics } = require('../../lib/custom-assertions')

function runCommand(client, cmd) {
  return new Promise((resolve, reject) => {
    client.query(cmd, function (err) {
      if (err) {
        reject(err)
      }

      resolve()
    })
  })
}

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
   * @param {*} pg Postgres
   */
  async function postgresSetup(pg) {
    const setupClient = new pg.Client(CON_OBJ)

    await new Promise((resolve, reject) => {
      setupClient.connect(function (err) {
        if (err) {
          reject(err)
        }

        resolve()
      })
    })
    await runCommand(setupClient, "set client_min_messages='warning';") // suppress PG notices

    const tableDrop = `drop table if exists ${TABLE_PREPARED}`
    await runCommand(setupClient, tableDrop)

    const tableCreate = `create table ${TABLE_PREPARED} (${PK} integer primary key, ${COL} text)`
    await runCommand(setupClient, tableCreate)
    setupClient.end()
  }

  function verify(expect = assert, transaction, selectTable) {
    verifyMetrics(expect, transaction, selectTable)
    verifyTrace(expect, transaction, selectTable)
    verifyInstanceParameters(expect, transaction)
  }

  function verifyMetrics(expect = assert, transaction, selectTable) {
    const agent = transaction.agent
    selectTable = selectTable || TABLE
    expect.equal(
      Object.keys(transaction.metrics.scoped).length,
      0,
      'should not have any scoped metrics'
    )

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
      expect.ok(unscoped[expectedName], 'should have unscoped metric ' + expectedName)
      if (unscoped[expectedName]) {
        expect.equal(
          unscoped[expectedName].callCount,
          expected[expectedName],
          'metric ' + expectedName + ' should have correct callCount'
        )
      }
    })

    expect.equal(
      unscopedNames.length,
      expectedNames.length,
      'should have correct number of unscoped metrics'
    )
  }

  function verifyTrace(expect = assert, transaction, selectTable) {
    selectTable = selectTable || TABLE
    const trace = transaction.trace

    expect.ok(trace, 'trace should exist')
    expect.ok(trace.root, 'root element should exist')

    const setSegment = findSegment(
      trace,
      trace.root,
      'Datastore/statement/Postgres/' + TABLE + '/insert'
    )

    const getSegment = findSegment(
      trace,
      trace.root,
      'Datastore/statement/Postgres/' + selectTable + '/select'
    )

    expect.ok(setSegment, 'trace segment for insert should exist')
    expect.ok(getSegment, 'trace segment for select should exist')

    if (!getSegment) {
      return
    }

    expect.equal(
      getSegment.name,
      'Datastore/statement/Postgres/' + selectTable + '/select',
      'should register the query call'
    )

    expect.ok(getSegment.timer.hrDuration, 'trace segment should have ended')
  }

  function verifyInstanceParameters(expect = assert, transaction) {
    const agent = transaction.agent
    const trace = transaction.trace

    const setSegment = findSegment(
      trace,
      trace.root,
      'Datastore/statement/Postgres/' + TABLE + '/insert'
    )
    const attributes = setSegment.getAttributes()

    const metricHostName = getMetricHostName(agent, params.postgres_host)
    expect.equal(attributes.host, metricHostName, 'should add the host parameter')
    expect.equal(
      attributes.port_path_or_id,
      String(params.postgres_port),
      'should add the port parameter'
    )
    expect.equal(
      attributes.database_name,
      params.postgres_db,
      'should add the database name parameter'
    )
    expect.equal(attributes.product, 'Postgres', 'should add the product attribute')
  }

  function verifySlowQueries(expect = assert, agent) {
    const metricHostName = getMetricHostName(agent, params.postgres_host)

    expect.equal(agent.queries.samples.size, 1, 'should have one slow query')
    for (const sample of agent.queries.samples.values()) {
      const queryParams = sample.getParams()

      expect.equal(
        queryParams.host,
        metricHostName,
        'instance data should show up in slow query params'
      )

      expect.equal(
        queryParams.port_path_or_id,
        String(params.postgres_port),
        'instance data should show up in slow query params'
      )

      expect.equal(
        queryParams.database_name,
        params.postgres_db,
        'database name should show up in slow query params'
      )

      expect.ok(queryParams.backtrace, 'params should contain a backtrace')
    }
  }

  test('Postgres instrumentation: ' + name, async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      ctx.nr.agent = helper.instrumentMockedAgent()
      ctx.nr.pg = clientFactory()

      return postgresSetup(ctx.nr.pg)
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)

      // The pg module has `native` lazy getter that is removed after first
      // call, so in order to re-instrument, we need to remove the pg module
      // from the cache. For some unknown reason, we cannot use our utility
      // methods for busting the require cache on this module. If we do,
      // any require after the first will result in a "Module did not
      // self-register" error regarding the native add-on.
      const pgName = require.resolve('pg')
      delete require.cache[pgName]
    })

    await t.test('should log tracking metrics', function(t) {
      const { agent } = t.nr
      const { version } = require('pg/package.json')
      assertPackageMetrics({ agent, pkg: 'pg', version })
    })

    await t.test('simple query with prepared statement', (t, end) => {
      const { agent, pg } = t.nr
      const client = new pg.Client(CON_OBJ)

      t.after(() => client.end())

      assert.equal(agent.getTransaction(), undefined, 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        assert.ok(transaction, 'transaction should be visible')
        assert.equal(tx, transaction, 'We got the same transaction')

        const colVal = 'Hello'
        const pkVal = 111
        const insQuery = `insert into ${TABLE_PREPARED} (${PK}, ${COL}) values($1, $2)`

        client.connect(function (error) {
          assert.ifError(error)

          client.query(insQuery, [pkVal, colVal], function (error, ok) {
            assert.ifError(error)

            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            assert.ok(ok, 'everything should be peachy after setting')

            let selQuery = 'SELECT * FROM ' + TABLE_PREPARED + ' WHERE '
            selQuery += PK + '=' + pkVal + ';'

            client.query(selQuery, function (error, value) {
              assert.ifError(error)

              assert.ok(agent.getTransaction(), 'transaction should still still be visible')
              assert.equal(value.rows[0][COL], colVal, 'Postgres client should still work')

              transaction.end()
              verify(assert, transaction)
              end()
            })
          })
        })
      })
    })

    await t.test('Promise style query', (t, end) => {
      const { agent, pg } = t.nr
      const client = new pg.Client(CON_OBJ)

      t.after(() => client.end())

      helper.runInTransaction(agent, async function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        assert.ok(transaction, 'transaction should be visible')
        assert.equal(tx, transaction, 'We got the same transaction')

        const colVal = 'Hello'
        const pkVal = 111
        let insQuery = 'INSERT INTO ' + TABLE_PREPARED + ' (' + PK + ',' + COL
        insQuery += ') VALUES($1, $2);'

        try {
          await client.connect()
        } catch (err) {
          assert.ifError(err)
        }

        try {
          const results = await client.query(insQuery, [pkVal, colVal])

          assert.ok(agent.getTransaction(), 'transaction should still be visible')
          assert.ok(results, 'everything should be peachy after setting')

          const selQuery = `select * from ${TABLE_PREPARED} where ${PK} = ${pkVal}`
          const selectResults = await client.query(selQuery)

          assert.ok(agent.getTransaction(), 'transaction should still still be visible')
          assert.equal(selectResults.rows[0][COL], colVal, 'Postgres client should still work')
          transaction.end()
          verify(assert, transaction)
          end()
        } catch (err) {
          assert.ifError(err)
          end()
        }
      })
    })

    await t.test('Submittable style Query timings', (t, end) => {
      const { agent, pg } = t.nr
      // see bottom of this page https://node-postgres.com/guides/upgrading
      const client = new pg.Client(CON_OBJ)

      t.after(() => client.end())

      assert.equal(agent.getTransaction(), undefined, 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        assert.ok(transaction, 'transaction should be visible')
        assert.equal(tx, transaction, 'We got the same transaction')

        const selQuery = 'SELECT pg_sleep(2), now() as sleep;'

        client.connect(function (error) {
          assert.ifError(error)
          const pgQuery = client.query(new pg.Query(selQuery))

          pgQuery.on('error', (error) => {
            assert.ifError(error)
            end()
          })

          pgQuery.on('end', () => {
            const finalTx = agent.getTransaction()
            assert.ok(finalTx, 'transaction should still be visible')

            transaction.end()

            const metrics = finalTx.metrics.getMetric('Datastore/operation/Postgres/select')
            assert.ok(
              metrics.total > 2.0,
              'Submittable style Query pg_sleep of 2 seconds should result in > 2 seßc timing'
            )

            end()
          })
        })
      })
    })

    await t.test('Promise style query timings', (t, end) => {
      const { agent, pg } = t.nr
      const client = new pg.Client(CON_OBJ)

      t.after(() => client.end())

      helper.runInTransaction(agent, async function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        assert.ok(transaction, 'transaction should be visible')
        assert.equal(tx, transaction, 'We got the same transaction')

        try {
          await client.connect()
        } catch (err) {
          assert.ifError(err)
        }

        try {
          const selQuery = 'SELECT pg_sleep(2), now() as sleep;'

          const selectResults = await client.query(selQuery)

          const finalTx = agent.getTransaction()
          assert.ok(finalTx, 'transaction should still be visible')
          assert.ok(selectResults, 'Postgres client should still work')
          transaction.end()

          const metrics = finalTx.metrics.getMetric('Datastore/operation/Postgres/select')
          assert.ok(
            metrics.total > 2.0,
            'Promise style query pg_sleep of 2 seconds should result in > 2 sec timing'
          )

          end()
        } catch (err) {
          assert.ifError(err)
          end()
        }
      })
    })

    await t.test('Callback style query timings', (t, end) => {
      const { agent, pg } = t.nr
      const client = new pg.Client(CON_OBJ)

      t.after(() => client.end())

      helper.runInTransaction(agent, async function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        assert.ok(transaction, 'transaction should be visible')
        assert.equal(tx, transaction, 'We got the same transaction')

        client.connect(function (error) {
          assert.ifError(error)

          const selQuery = 'SELECT pg_sleep(2), now() as sleep;'

          client.query(selQuery, function (error, ok) {
            assert.ifError(error)
            const finalTx = agent.getTransaction()
            assert.ok(finalTx, 'transaction should still be visible')
            assert.ok(ok, 'everything should be peachy after setting')

            transaction.end()
            const metrics = finalTx.metrics.getMetric('Datastore/operation/Postgres/select')
            assert.ok(
              metrics.total > 2.0,
              'Callback style query pg_sleep of 2 seconds should result in > 2 sec timing'
            )

            end()
          })
        })
      })
    })

    await t.test('client pooling query', async (t) => {
      const plan = tspl(t, { plan: 39 })
      const { agent, pg } = t.nr

      plan.equal(agent.getTransaction(), undefined, 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        plan.ok(transaction, 'transaction should be visible')
        plan.equal(tx, transaction, 'We got the same transaction')

        const colVal = 'World!'
        const pkVal = 222
        const insQuery = `insert into ${TABLE_PREPARED} (${PK}, ${COL}) values('${pkVal}', '${colVal}')`
        const pool = new pg.Pool(CON_OBJ)
        pool.query(insQuery, function (error, ok) {
          plan.ifError(error)

          plan.ok(agent.getTransaction(), 'transaction should still be visible')
          plan.ok(ok, 'everything should be peachy after setting')

          const selQuery = `select * from ${TABLE_PREPARED} where ${PK} = ${pkVal}`
          pool.query(selQuery, function (error, value) {
            plan.ifError(error)

            plan.ok(agent.getTransaction(), 'transaction should still still be visible')
            plan.equal(value.rows[0][COL], colVal, 'Postgres client should still work')

            transaction.end()
            pool.end()
            verify(plan, transaction)
          })
        })
      })

      await plan.completed
    })

    await t.test('using Pool constructor', async (t) => {
      const plan = tspl(t, { plan: 40 })
      const { agent, pg } = t.nr

      plan.equal(agent.getTransaction(), undefined, 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        plan.ok(transaction, 'transaction should be visible')
        plan.equal(tx, transaction, 'We got the same transaction')

        const colVal = 'World!'
        const pkVal = 222
        let insQuery = 'INSERT INTO ' + TABLE_PREPARED + ' (' + PK + ',' + COL
        insQuery += ') VALUES(' + pkVal + ",'" + colVal + "');"

        const pool = new pg.Pool(CON_OBJ)

        pool.connect(function (error, client, done) {
          plan.ifError(error)

          client.query(insQuery, function (error, ok) {
            plan.ifError(error)

            plan.ok(agent.getTransaction(), 'transaction should still be visible')
            plan.ok(ok, 'everything should be peachy after setting')

            let selQuery = 'SELECT * FROM ' + TABLE_PREPARED + ' WHERE '
            selQuery += PK + '=' + pkVal + ';'

            client.query(selQuery, function (error, value) {
              plan.ifError(error)

              plan.ok(agent.getTransaction(), 'transaction should still still be visible')
              plan.equal(value.rows[0][COL], colVal, 'Postgres client should still work')

              transaction.end()
              if (pool.end instanceof Function) {
                pool.end()
              }

              done(true)
              verify(plan, transaction)
            })
          })
        })
      })

      await plan.completed
    })

    // https://github.com/newrelic/node-newrelic/pull/223
    await t.test(
      'query using an config object with `text` getter instead of property',
      async (t) => {
        const plan = tspl(t, { plan: 3 })
        const { agent, pg } = t.nr
        const client = new pg.Client(CON_OBJ)

        t.after(() => client.end())

        helper.runInTransaction(agent, function () {
          const transaction = agent.getTransaction()

          const colVal = 'Sianara'
          const pkVal = 444

          function CustomConfigClass() {
            this._text = `insert into ${TABLE_PREPARED} (${PK}, ${COL}) values($1, $2)`
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
            plan.ifError(error)

            client.query(config, [pkVal, colVal], function (error) {
              plan.ifError(error)
              const segment = findSegment(
                transaction.trace,
                transaction.trace.root,
                'Datastore/statement/Postgres/' + TABLE + '/insert'
              )
              plan.ok(segment, 'expected segment exists')
            })
          })
        })

        await plan.completed
      }
    )

    await t.test('should add datastore instance parameters to slow query traces', async (t) => {
      const plan = tspl(t, { plan: 7 })
      const { agent, pg } = t.nr

      // enable slow queries
      agent.config.transaction_tracer.record_sql = 'raw'
      agent.config.slow_sql.enabled = true

      const client = new pg.Client(CON_OBJ)

      t.after(() => client.end())

      helper.runInTransaction(agent, function () {
        const transaction = agent.getTransaction()
        client.connect(function (error) {
          plan.ifError(error)

          client.query('SELECT * FROM pg_sleep(1);', function slowQueryCB(error) {
            plan.ifError(error)

            transaction.end()
            verifySlowQueries(plan, agent)
          })
        })
      })

      await plan.completed
    })

    await t.test(
      'should not add datastore instance parameters to slow query traces when' + ' disabled',
      async (t) => {
        const plan = tspl(t, { plan: 5 })
        const { agent, pg } = t.nr

        // enable slow queries
        agent.config.transaction_tracer.record_sql = 'raw'
        agent.config.slow_sql.enabled = true

        // disable datastore instance
        agent.config.datastore_tracer.instance_reporting.enabled = false
        agent.config.datastore_tracer.database_name_reporting.enabled = false

        const client = new pg.Client(CON_OBJ)

        t.after(() => client.end())

        helper.runInTransaction(agent, function () {
          const transaction = agent.getTransaction()
          client.connect(function (error) {
            plan.ifError(error)

            client.query('SELECT * FROM pg_sleep(1);', function (error) {
              plan.ifError(error)

              transaction.end()
              const queryParams = agent.queries.samples.values().next().value

              plan.equal(queryParams.host, undefined, 'should not have host parameter')

              plan.equal(queryParams.port_path_or_id, undefined, 'should not have port parameter')

              plan.equal(
                queryParams.database_name,
                undefined,
                'should not have database name parameter'
              )
            })
          })
        })

        await plan.completed
      }
    )
  })
}
