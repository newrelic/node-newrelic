/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var a = require('async')
var tap = require('tap')
var params = require('../../../lib/params')
var helper = require('../../../lib/agent_helper')
var findSegment = require('../../../lib/metrics_helper').findSegment
var test = tap.test
var getMetricHostName = require('../../../lib/metrics_helper').getMetricHostName

module.exports = function runTests(name, clientFactory) {
  // constants for table creation and db connection
  var TABLE = 'testTable-post'
  var TABLE_PREPARED = '"' + TABLE + '"'
  var PK = 'pk_column'
  var COL = 'test_column'
  var CON_OBJ = {
    user: params.postgres_user,
    password: params.postgres_pass,
    host: params.postgres_host,
    port: params.postgres_port,
    database: params.postgres_db
  }

  /**
   * Deletion of testing table if already exists,
   * then recreation of a testing table
   *
   *
   * @param Callback function to set off running the tests
   */
  function postgresSetup(runTest) {
    var pg = clientFactory()
    var setupClient = new pg.Client(CON_OBJ)

    setupClient.connect(function(err) {
      if (err) {
        throw err
      }
      var tableDrop = 'DROP TABLE IF EXISTS ' + TABLE_PREPARED

      var tableCreate =
        'CREATE TABLE ' + TABLE_PREPARED + ' (' +
          PK + ' integer PRIMARY KEY, ' +
          COL + ' text' +
        ');'

      a.eachSeries([
        'set client_min_messages=\'warning\';', // supress PG notices
        tableDrop,
        tableCreate
      ], function(query, cb) {
        setupClient.query(query, cb)
      }, function(err) {
        if (err) {
          throw err
        }
        setupClient.end()
        runTest()
      })
    })
  }

  function verify(t, segment, selectTable) {
    verifyMetrics(t, segment, selectTable)
    verifyTrace(t, segment, selectTable)
    verifyInstanceParameters(t, segment)
  }

  function verifyMetrics(t, segment, selectTable) {
    var transaction = segment.transaction
    var agent = transaction.agent
    selectTable = selectTable || TABLE
    t.equal(
      Object.keys(transaction.metrics.scoped).length, 0,
      'should not have any scoped metrics'
    )

    var unscoped = transaction.metrics.unscoped

    var expected = {
      'Datastore/all': 2,
      'Datastore/allWeb': 2,
      'Datastore/Postgres/all': 2,
      'Datastore/Postgres/allWeb': 2,
      'Datastore/operation/Postgres/insert': 1,
      'Datastore/operation/Postgres/select': 1,
    }

    expected['Datastore/statement/Postgres/' + TABLE + '/insert'] = 1
    expected['Datastore/statement/Postgres/' + selectTable + '/select'] = 1

    var metricHostName = getMetricHostName(agent, params.postgres_host)
    var hostId = metricHostName + '/' + params.postgres_port
    expected['Datastore/instance/Postgres/' + hostId] = 2

    var expectedNames = Object.keys(expected)
    var unscopedNames = Object.keys(unscoped)

    expectedNames.forEach(function(expectedName) {
      t.ok(unscoped[expectedName], 'should have unscoped metric ' + expectedName)
      if (unscoped[expectedName]) {
        t.equals(
          unscoped[expectedName].callCount, expected[expectedName],
          'metric ' + expectedName + ' should have correct callCount'
        )
      }
    })

    t.equals(
      unscopedNames.length, expectedNames.length,
      'should have correct number of unscoped metrics'
    )
  }

  function verifyTrace(t, segment, selectTable) {
    var transaction = segment.transaction
    selectTable = selectTable || TABLE
    var trace = transaction.trace

    t.ok(trace, 'trace should exist')
    t.ok(trace.root, 'root element should exist')

    var setSegment = findSegment(
      trace.root,
      'Datastore/statement/Postgres/' + TABLE + '/insert'
    )

    var getSegment = findSegment(
      trace.root,
      'Datastore/statement/Postgres/' + selectTable + '/select'
    )

    t.ok(setSegment, 'trace segment for insert should exist')
    t.ok(getSegment, 'trace segment for select should exist')

    if (!getSegment) return

    t.equals(
      getSegment.name,
      'Datastore/statement/Postgres/' + selectTable + '/select',
      'should register the query call'
    )

    t.ok(getSegment.timer.hrDuration, 'trace segment should have ended')
  }

  function verifyInstanceParameters(t, segment) {
    var transaction = segment.transaction
    var agent = transaction.agent
    var trace = transaction.trace

    var setSegment = findSegment(
      trace.root,
      'Datastore/statement/Postgres/' + TABLE + '/insert'
    )
    const attributes = setSegment.getAttributes()

    var metricHostName = getMetricHostName(agent, params.postgres_host)
    t.equals(
      attributes.host,
      metricHostName,
      'should add the host parameter'
    )
    t.equals(
      attributes.port_path_or_id,
      String(params.postgres_port),
      'should add the port parameter'
    )
    t.equals(
      attributes.database_name,
      params.postgres_db,
      'should add the database name parameter'
    )
    t.equals(
      attributes.product,
      'Postgres',
      'should add the product attribute'
    )
  }

  function verifySlowQueries(t, agent) {
    var metricHostName = getMetricHostName(agent, params.postgres_host)

    t.equals(agent.queries.samples.size, 1, 'should have one slow query')
    for (let sample of agent.queries.samples.values()) {
      const queryParams = sample.getParams()

      t.equal(
        queryParams.host,
        metricHostName,
        'instance data should show up in slow query params'
      )

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

  test('Postgres instrumentation: ' + name, function(t) {
    t.autoend()

    var agent = null
    var pg = null

    t.beforeEach(function(done) {
      // the pg module has `native` lazy getter that is removed after first call,
      // so in order to re-instrument, we need to remove the pg module from the cache
      var pgName = require.resolve('pg')
      delete require.cache[pgName]

      agent = helper.instrumentMockedAgent()
      pg = clientFactory()

      postgresSetup(done)
    })

    t.afterEach(function(done) {
      helper.unloadAgent(agent)
      agent = null
      pg = null
      done()
    })

    t.test('simple query with prepared statement', function(t) {
      var client = new pg.Client(CON_OBJ)

      t.tearDown(function() {
        client.end()
      })

      t.notOk(agent.getTransaction(), 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        var colVal = 'Hello'
        var pkVal = 111
        var insQuery = 'INSERT INTO ' + TABLE_PREPARED + ' (' + PK + ',' +  COL
        insQuery += ') VALUES($1, $2);'

        client.connect(function(error) {
          if (!t.error(error)) {
            return t.end()
          }

          client.query(insQuery, [pkVal, colVal], function(error, ok) {
            if (!t.error(error)) {
              return t.end()
            }

            t.ok(agent.getTransaction(), 'transaction should still be visible')
            t.ok(ok, 'everything should be peachy after setting')

            var selQuery = 'SELECT * FROM ' + TABLE_PREPARED + ' WHERE '
            selQuery += PK + '=' + pkVal + ';'

            client.query(selQuery, function(error, value) {
              if (!t.error(error)) {
                return t.end()
              }

              t.ok(agent.getTransaction(), 'transaction should still still be visible')
              t.equals(value.rows[0][COL], colVal, 'Postgres client should still work')

              transaction.end()
              verify(t, agent.tracer.getSegment())
              t.end()
            })
          })
        })
      })
    })

    t.test('client pooling query', function(t) {
      t.plan(39)
      t.notOk(agent.getTransaction(), 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        var colVal = 'World!'
        var pkVal = 222
        var insQuery = 'INSERT INTO ' + TABLE_PREPARED + ' (' + PK + ',' +  COL
        insQuery += ') VALUES(' + pkVal + ",'" + colVal + "');"
        var pool = new pg.Pool(CON_OBJ)
        pool.query(insQuery, function(error, ok) {
          if (!t.error(error)) {
            return t.end()
          }

          t.ok(agent.getTransaction(), 'transaction should still be visible')
          t.ok(ok, 'everything should be peachy after setting')

          var selQuery = 'SELECT * FROM ' + TABLE_PREPARED + ' WHERE '
          selQuery += PK + '=' + pkVal + ';'

          pool.query(selQuery, function(error, value) {
            if (!t.error(error)) {
              return t.end()
            }

            t.ok(agent.getTransaction(), 'transaction should still still be visible')
            t.equals(value.rows[0][COL], colVal, 'Postgres client should still work')

            transaction.end()
            pool.end()
            verify(t, agent.tracer.getSegment())
          })
        })
      })
    })

    t.test('using Pool constructor', function(t) {
      t.plan(40)

      t.notOk(agent.getTransaction(), 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        var colVal = 'World!'
        var pkVal = 222
        var insQuery = 'INSERT INTO ' + TABLE_PREPARED + ' (' + PK + ',' +  COL
        insQuery += ') VALUES(' + pkVal + ",'" + colVal + "');"

        var pool = null
        if (pg.Pool) {
          pool = new pg.Pool(CON_OBJ)
        } else {
          pool = pg.pools.getOrCreate(CON_OBJ)
        }

        pool.connect(function(error, client, done) {
          if (!t.error(error)) {
            return t.end()
          }

          client.query(insQuery, function(error, ok) {
            if (!t.error(error)) {
              return t.end()
            }

            t.ok(agent.getTransaction(), 'transaction should still be visible')
            t.ok(ok, 'everything should be peachy after setting')

            var selQuery = 'SELECT * FROM ' + TABLE_PREPARED + ' WHERE '
            selQuery += PK + '=' + pkVal + ';'

            client.query(selQuery, function(error, value) {
              if (!t.error(error)) {
                return t.end()
              }

              t.ok(agent.getTransaction(), 'transaction should still still be visible')
              t.equals(value.rows[0][COL], colVal, 'Postgres client should still work')

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
      var client = new pg.Client(CON_OBJ)

      t.tearDown(function() {
        client.end()
      })

      helper.runInTransaction(agent, function() {
        var transaction = agent.getTransaction()

        var colVal = 'Sianara'
        var pkVal = 444

        function CustomConfigClass() {
          this._text = 'INSERT INTO ' + TABLE_PREPARED + ' (' + PK + ',' +  COL
          this._text += ') VALUES($1, $2);'
        }

        // "text" is defined as a getter on the prototype, so it will not be
        // a property owned by the instance
        Object.defineProperty(CustomConfigClass.prototype, 'text', {
          get: function() {
            return this._text
          }
        })

        // create a config instance
        var config = new CustomConfigClass()

        client.connect(function(error) {
          if (!t.error(error)) {
            return t.end()
          }

          client.query(config, [pkVal, colVal], function(error) {
            if (!t.error(error)) {
              return t.end()
            }

            var segment = findSegment(
              transaction.trace.root,
              'Datastore/statement/Postgres/' + TABLE + '/insert'
            )
            t.ok(segment, 'expected segment exists')
          })
        })
      })
    })

    t.test('should add datastore instance parameters to slow query traces', function(t) {
      t.plan(7)
      // enable slow queries
      agent.config.transaction_tracer.record_sql = 'raw'
      agent.config.slow_sql.enabled = true

      var client = new pg.Client(CON_OBJ)

      t.tearDown(function() {
        client.end()
      })

      helper.runInTransaction(agent, function() {
        var transaction = agent.getTransaction()
        client.connect(function(error) {
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

    t.test("should not add datastore instance parameters to slow query traces when" +
        " disabled", function(t) {
      t.plan(5)

      // enable slow queries
      agent.config.transaction_tracer.record_sql = 'raw'
      agent.config.slow_sql.enabled = true

      // disable datastore instance
      agent.config.datastore_tracer.instance_reporting.enabled = false
      agent.config.datastore_tracer.database_name_reporting.enabled = false

      var client = new pg.Client(CON_OBJ)

      t.tearDown(function() {
        client.end()
      })

      helper.runInTransaction(agent, function() {
        var transaction = agent.getTransaction()
        client.connect(function(error) {
          if (!t.error(error)) {
            return t.end()
          }

          client.query('SELECT * FROM pg_sleep(1);', function(error) {
            if (!t.error(error)) {
              return t.end()
            }

            transaction.end()
            const queryParams = agent.queries.samples.values().next().value

            t.equal(
              queryParams.host,
              undefined,
              'should not have host parameter'
            )

            t.equal(
              queryParams.port_path_or_id,
              undefined,
              'should not have port parameter'
            )

            t.equal(
              queryParams.database_name,
              undefined,
              'should not have database name parameter'
            )
          })
        })
      })
    })
  })
}
