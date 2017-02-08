'use strict'

var a = require('async')
var tap = require('tap')
var params = require('../../lib/params')
var helper = require('../../lib/agent_helper')
var findSegment = require('../../lib/metrics_helper').findSegment
var test = tap.test
var getMetricHostName = require('../../lib/metrics_helper').getMetricHostName


module.exports = function runTests(name, clientFactory) {
  // constants for table creation and db connection
  var TABLE = 'testTable'
  var PK = 'pk_column'
  var COL = 'test_column'
  var CON_STRING = 'postgres://' + params.postgres_user + ':' + params.postgres_pass + '@'
        + params.postgres_host + ':' + params.postgres_port + '/' + params.postgres_db


  /**
   * Deletion of testing table if already exists,
   * then recreation of a testing table
   *
   *
   * @param Callback function to set off running the tests
   */
  function postgresSetup(runTest) {
    var pg = clientFactory()
    var setupClient = new pg.Client(CON_STRING)

    setupClient.connect(function(error) {
      if (error) {
        throw error
      }
      var tableDrop = 'DROP TABLE IF EXISTS ' + TABLE
      var tableCreate =
        'CREATE TABLE ' + TABLE + ' (' +
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
      'Datastore/allOther': 2,
      'Datastore/Postgres/all': 2,
      'Datastore/Postgres/allOther': 2,
      'Datastore/operation/Postgres/insert': 1,
      'Datastore/operation/Postgres/select': 1,
    }

    expected['Datastore/statement/Postgres/' + TABLE + '/insert'] = 1
    expected['Datastore/statement/Postgres/' + selectTable + '/select'] = 1

    var metricHostName = getMetricHostName(agent, 'postgres')
    var hostId = metricHostName + '/' + params.postgres_port
    expected['Datastore/instance/Postgres/' + hostId] = 2

    var expectedNames = Object.keys(expected)
    var unscopedNames = Object.keys(unscoped)

    expectedNames.forEach(function(name) {
      t.ok(unscoped[name], 'should have unscoped metric ' + name)
      if (unscoped[name]) {
        t.equals(
          unscoped[name].callCount, expected[name],
          'metric ' + name + ' should have correct callCount'
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

    t.equals(getSegment.name, 'Datastore/statement/Postgres/' + selectTable + '/select',
             'should register the query call')
    t.equals(segment.children.length, 0,
             'get should leave us here at the end')

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

    var metricHostName = getMetricHostName(agent, 'postgres')
    t.equals(setSegment.parameters.host, metricHostName,
      'should add the host parameter')
    t.equals(setSegment.parameters.port_path_or_id, String(params.postgres_port),
      'should add the port parameter')
    t.equals(
      setSegment.parameters.database_name,
      params.postgres_db,
      'should add the database name parameter'
    )
  }

  function verifySlowQueries(t, agent) {
    var metricHostName = getMetricHostName(agent, 'postgres')

    var slowQuerySamples = agent.queries.samples
    t.equals(Object.keys(agent.queries.samples).length, 1, 'should have one slow query')
    for (var key in slowQuerySamples) {
      var queryParams = slowQuerySamples[key].getParams()

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

  test('Postgres instrumentation: ' + name, function (t) {
    t.autoend()

    var agent
    var pg

    t.beforeEach(function(done) {
      try {
        // the pg module has `native` lazy getter that is removed after first
        // call, so in order to re-instrument, we need to remove the pg module
        // from the cache
        var name = require.resolve('pg')
        delete require.cache[name]

        agent = helper.instrumentMockedAgent()
        pg = clientFactory()

        postgresSetup(done)
      } catch(e) {
        done(e)
      }
    })

    t.afterEach(function(done) {
      helper.unloadAgent(agent)

      // close all clients in pool
      pg.end()

      done()
    })

    t.test('simple query with prepared statement', function (t) {
      var client = new pg.Client(CON_STRING)
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
        var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' +  COL
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

            var selQuery = 'SELECT * FROM ' + TABLE + ' WHERE '
            selQuery += PK + '=' + pkVal + ';'

            client.query(selQuery, function(error, value) {
              if (!t.error(error)) {
                return t.end()
              }

              t.ok(agent.getTransaction(), 'transaction should still still be visible')
              t.equals(value.rows[0][COL], colVal, 'Postgres client should still work')

              transaction.end(function() {
                verify(t, agent.tracer.getSegment())
                t.end()
              })
            })
          })
        })
      })
    })

    t.test("simple query using query.on() events", function (t) {
      t.plan(35)
      var client = new pg.Client(CON_STRING)

      t.tearDown(function() {
        client.end()
      })

      t.notOk(agent.getTransaction(), 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        var colVal = 'Goodbye'
        var pkVal = 333
        var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' +  COL
        insQuery += ') VALUES($1, $2);'

        client.connect(function (error) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          var query = client.query(insQuery, [pkVal, colVal])

          query.on('error', function(err) {
            t.error(err, 'error while querying')
            t.end()
          })

          query.on('end', function() {
            t.ok(agent.getTransaction(), 'transaction should still be visible')

            var selQuery = 'SELECT * FROM ' + TABLE + ' WHERE '
            selQuery += PK + '=' + pkVal + ';'

            var query = client.query(selQuery)

            query.on('error', function(err) {
              t.error(err, 'error while querying')
              t.end()
            })

            query.on('end', function() {
              t.ok(agent.getTransaction(), 'transaction should still still be visible')

              transaction.end(function() {
                verify(t, agent.tracer.getSegment())
              })
            })
          })
        })
      })
    })

    t.test("simple query using query.addListener() events", function (t) {
      t.plan(35)
      var client = new pg.Client(CON_STRING)

      t.tearDown(function() {
        client.end()
      })

      t.notOk(agent.getTransaction(), 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        var colVal = 'Sianara'
        var pkVal = 444
        var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' +  COL
        insQuery += ') VALUES($1, $2);'

        client.connect(function (error) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          var query = client.query(insQuery, [pkVal, colVal])

          query.addListener('error', function(err) {
            t.error(err, 'error while querying')
          })

          query.addListener('end', function() {
            t.ok(agent.getTransaction(), 'transaction should still be visible')

            var selQuery = 'SELECT * FROM ' + TABLE + ' WHERE '
            selQuery += PK + '=' + pkVal + ';'

            var query = client.query(selQuery)

            query.addListener('error', function(err) {
              t.error(err, 'error while querying')
              t.end()
            })

            query.addListener('end', function() {
              t.ok(agent.getTransaction(), 'transaction should still still be visible')

              transaction.end(function() {
                verify(t, agent.tracer.getSegment())
              })
            })
          })
        })
      })
    })

    t.test('client pooling query', function (t) {
      t.plan(37)
      t.notOk(agent.getTransaction(), 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        var colVal = 'World!'
        var pkVal = 222
        var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' +  COL
        insQuery += ') VALUES(' + pkVal + ",'" + colVal + "');"

        pg.connect(CON_STRING, function(error, clientPool, done) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          clientPool.query(insQuery, function (error, ok) {
            if (error) {
              t.fail(error)
              return t.end()
            }

            t.ok(agent.getTransaction(), 'transaction should still be visible')
            t.ok(ok, 'everything should be peachy after setting')

            var selQuery = 'SELECT * FROM ' + TABLE + ' WHERE '
            selQuery += PK + '=' + pkVal + ';'

            clientPool.query(selQuery, function (error, value) {
              if (error) {
                t.fail(error)
                return t.end()
              }

              t.ok(agent.getTransaction(), 'transaction should still still be visible')
              t.equals(value.rows[0][COL], colVal, 'Postgres client should still work')

              transaction.end(function() {
                done()
                verify(t, agent.tracer.getSegment())
              })
            })
          })
        })
      })
    })

    // https://github.com/newrelic/node-newrelic/pull/223
    t.test("query using an config object with `text` getter instead of property",
        function (t) {
      t.plan(1)
      var client = new pg.Client(CON_STRING)

      t.tearDown(function() {
        client.end()
      })

      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction()

        var colVal = 'Sianara'
        var pkVal = 444

        function CustomConfigClass() {
          this._text = 'INSERT INTO ' + TABLE + ' (' + PK + ',' +  COL
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

        client.connect(function (error) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          var query = client.query(config, [pkVal, colVal], function (error, value) {
            if (error) {
              t.fail(error)
              return t.end()
            }

            var segment = findSegment(transaction.trace.root,
              'Datastore/statement/Postgres/' + TABLE + '/insert')
            t.ok(segment, 'expected segment exists')
          })
        })
      })
    })

    t.test("should add datastore instance parameters to slow query traces", function (t) {
      t.plan(5)
      // enable slow queries
      agent.config.transaction_tracer.record_sql = 'raw'
      agent.config.slow_sql.enabled = true

      var client = new pg.Client(CON_STRING)

      t.tearDown(function() {
        client.end()
      })

      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction()
        client.connect(function (error) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          client.query('SELECT * FROM pg_sleep(1);', function (error, value) {
            if (error) {
              t.fail(error)
              return t.end()
            }

            transaction.end(function () {
              verifySlowQueries(t, agent)
            })
          })
        })
      })
    })

    t.test("should not add datastore instance parameters to slow query traces when" +
        " disabled", function (t) {
      t.plan(3)

      // enable slow queries
      agent.config.transaction_tracer.record_sql = 'raw'
      agent.config.slow_sql.enabled = true

      // disable datastore instance
      agent.config.datastore_tracer.instance_reporting.enabled = false
      agent.config.datastore_tracer.database_name_reporting.enabled = false

      var client = new pg.Client(CON_STRING)

      t.tearDown(function() {
        client.end()
      })

      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction()
        client.connect(function (error) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          client.query('SELECT * FROM pg_sleep(1);', function (error, value) {
            if (error) {
              t.fail(error)
              return t.end()
            }

            transaction.end(function () {
              var slowQuerySamples = agent.queries.samples
              var key = Object.keys(agent.queries.samples)[0]
              var queryParams = slowQuerySamples[key].getParams()

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

    t.test('query.on should still be chainable', function (t) {
      t.plan(1)
      var client = new pg.Client(CON_STRING)

      t.tearDown(function() {
        client.end()
      })

      client.connect(function (error) {
        if (error) {
          t.fail(error)
          return t.end()
        }

        var query = client.query('SELECT table_name FROM information_schema.tables')

        query.on('error', function(err) {
          t.error(err, 'error while querying')
          t.end()
        }).on('end', function ended() {
          t.pass('successfully completed')
        })
      })
    })

    t.test('query.on should not create segments for row events', function (t) {
      t.plan(1)

      helper.runInTransaction(agent, function transactionInScope(tx) {
        var client = new pg.Client(CON_STRING)

        t.tearDown(function() {
          client.end()
        })

        client.connect(function (error) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          var query = client.query('SELECT table_name FROM information_schema.tables')

          query.on('error', function(err) {
            t.error(err, 'error while querying')
            t.end()
          })

          query.on('row', function onRow(row) {})

          query.on('end', function ended() {
            var segment = findSegment(tx.trace.root,
              'Datastore/statement/Postgres/information_schema.tables/select')

            t.equal(segment.children.length, 1)
          })
        })
      })
    })

    t.test('query.addListener should not create segments for row events', function (t) {
      t.plan(1)

      helper.runInTransaction(agent, function transactionInScope(tx) {
        var client = new pg.Client(CON_STRING)

        t.tearDown(function() {
          client.end()
        })

        client.connect(function (error) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          var query = client.query('SELECT table_name FROM information_schema.tables')

          query.addListener('error', function(err) {
            t.error(err, 'error while querying')
            t.end()
          })

          query.addListener('row', function onRow(row) {})

          query.addListener('end', function ended() {
            var segment = findSegment(tx.trace.root,
              'Datastore/statement/Postgres/information_schema.tables/select')

            t.equal(segment.children.length, 1)
          })
        })
      })
    })

    t.test('query.on should not create segments for each row with readable stream', function (t) {
      t.plan(2)

      helper.runInTransaction(agent, function transactionInScope(tx) {
        var client = new pg.Client(CON_STRING)

        t.tearDown(function() {
          client.end()
        })

        client.connect(function (error) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          var query = client.query('SELECT * FROM generate_series(0, 9)')

          query.on('error', function(err) {
            t.error(err, 'error while querying')
            t.end()
          })

          // simulate readable stream by emitting 'readable' event for each row
          query.on('row', function onRow(row) {
            query.emit('readable', row)
          })

          var called = 0
          query.on('readable', function onReadable(row) {
            called++
          })

          query.on('end', function ended() {
            var segment = findSegment(tx.trace.root,
              'Datastore/statement/Postgres/generate_series/select')

            t.equal(segment.children.length, 1)
            t.equal(called, 10, 'event was called for each row')
          })
        })
      })
    })

    t.test('query.addListener should not create segments for each row with readable stream', function (t) {
      t.plan(2)

      helper.runInTransaction(agent, function transactionInScope(tx) {
        var client = new pg.Client(CON_STRING)

        t.tearDown(function() {
          client.end()
        })

        client.connect(function (error) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          var query = client.query('SELECT * FROM generate_series(0, 9)')

          query.addListener('error', function(err) {
            t.error(err, 'error while querying')
            t.end()
          })

          // simulate readable stream by emitting 'readable' event for each row
          query.addListener('row', function onRow(row) {
            query.emit('readable', row)
          })

          var called = 0
          query.addListener('readable', function onReadable(row) {
            called++
          })

          query.addListener('end', function ended() {
            var segment = findSegment(tx.trace.root,
              'Datastore/statement/Postgres/generate_series/select')

            t.equal(segment.children.length, 1)
            t.equal(called, 10, 'event was called for each row')
          })
        })
      })
    })
  })
}
