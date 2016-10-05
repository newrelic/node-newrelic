'use strict'

var tap = require('tap')
var params = require('../../lib/params')
var helper = require('../../lib/agent_helper')
var findSegment = require('../../lib/metrics_helper').findSegment
var test = tap.test
var urltils = require('../../../lib/util/urltils')


module.exports = function runTests(agent, pg, name) {
  // constants for table creation and db connection
  var TABLE = 'testTable'
  var PK = 'pk_column'
  var COL = 'test_column'
  var CON_STRING = 'postgres://' + params.postgres_user + ':' + params.postgres_pass + '@'
        + params.postgres_host + ':' + params.postgres_port + '/' + params.postgres_db
  var METRIC_HOST_NAME = urltils.isLocalhost(params.postgres_host)
    ? agent.config.getHostnameSafe()
    : params.postgres_host


  /**
   * Deletion of testing table if already exists,
   * then recreation of a testing table
   *
   *
   * @param Callback function to set off running the tests
   */
  function postgresSetup(runTest) {
    var setupClient = new pg.Client(CON_STRING)

    setupClient.connect(function(error) {
      if (error) {
        throw error
      }
      var tableDrop = 'DROP TABLE IF EXISTS ' + TABLE

      var tableCreate = 'CREATE TABLE ' + TABLE + ' (' + PK + ' integer PRIMARY KEY, '
      tableCreate += COL + ' text);'

      setupClient.query(tableDrop, function(error) {
        if (error) {
          throw error
        }
        setupClient.query(tableCreate, function(error) {
          if (error) {
            throw error
          }
          setupClient.end()
          runTest()
        })
      })
    })
   }

  function verify(t, segment, selectTable) {
    var transaction = segment.transaction
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

    var hostId = METRIC_HOST_NAME + '/' + params.postgres_port
    expected['Datastore/instance/Postgres/' + hostId] = 2

    var slowQuerySamples = agent.queries.samples
    for (var key in slowQuerySamples) {
      var queryParams = slowQuerySamples[key].getParams()

      t.equal(
        queryParams.host,
        METRIC_HOST_NAME,
        'instance data should show up in slow query params'
      )

      t.equal(
        queryParams.port_path_or_id,
        params.postgres_port,
        'instance data should show up in slow query params'
      )

      t.equal(
        queryParams.database_name,
        params.postgres_db,
        'database name should show up in slow query params'
      )

      t.ok(queryParams.backtrace, 'params should contain a backtrace')
    }

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

    t.equal(
      setSegment.parameters.host,
      METRIC_HOST_NAME,
      'instance data should show up in slow query params'
    )
    t.equal(
      setSegment.parameters.port_path_or_id,
      params.postgres_port,
      'instance data should show up in slow query params'
    )
    t.equals(
      setSegment.parameters.database_name,
      params.postgres_db,
      'should add the database name parameter'
    )

    if (!getSegment) return t.end()

    t.equals(getSegment.name, 'Datastore/statement/Postgres/' + selectTable + '/select',
             'should register the query call')
    t.equals(segment.children.length, 0,
             'get should leave us here at the end')

    t.ok(getSegment.timer.hrDuration, 'trace segment should have ended')
    t.end()
  }

  test('Postgres instrumentation: ' + name, function (t) {
    t.plan(8)
    postgresSetup(runTest)
    function runTest () {
      t.test('simple query with prepared statement', function (t) {
        var client = new pg.Client(CON_STRING)

        t.notOk(agent.getTransaction(), 'no transaction should be in play')
        helper.runInTransaction(agent, function transactionInScope(tx) {
          var transaction = agent.getTransaction()
          t.ok(transaction, 'transaction should be visible')
          t.equal(tx, transaction, 'We got the same transaction')

          var colVal = 'Hello'
          var pkVal = 111
          var insQuery = 'INSERT INTO ' + TABLE + ' (' + PK + ',' +  COL
          insQuery += ') VALUES($1, $2);'

          client.connect(function (error) {
            if (error) return t.fail(error)
            client.query(insQuery, [pkVal, colVal], function (error, ok) {
              if (error) return t.fail(error)
              t.ok(agent.getTransaction(), 'transaction should still be visible')
              t.ok(ok, 'everything should be peachy after setting')

              var selQuery = 'SELECT * FROM ' + TABLE + ' WHERE '
              selQuery += PK + '=' + pkVal + ';'

              client.query(selQuery, function (error, value) {
                if (error) return t.fail(error)
                t.ok(agent.getTransaction(), 'transaction should still still be visible')
                t.equals(value.rows[0][COL], colVal, 'Postgres client should still work')

                transaction.end(function() {
                  client.end()
                  verify(t, agent.tracer.getSegment())
                })
              })
            })
          })
        })
      })

      t.test("simple query using query.on() events", function (t) {

        var client = new pg.Client(CON_STRING)

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
            if (error) return t.fail(error)
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
                  client.end()
                  verify(t, agent.tracer.getSegment())
                })
              })
            })
          })
        })
      })

      t.test("simple query using query.addListener() events", function (t) {

        var client = new pg.Client(CON_STRING)

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
            if (error) return t.fail(error)
            var query = client.query(insQuery, [pkVal, colVal])

            query.addListener('error', function(err) {
              t.error(err, 'error while querying')
              t.end()
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
                  client.end()
                  verify(t, agent.tracer.getSegment())
                })
              })
            })
          })
        })
      })

      t.test('client pooling query', function (t) {
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
            if (error) return t.fail (error)
            clientPool.query(insQuery, function (error, ok) {
              if (error) return t.fail(error)
              t.ok(agent.getTransaction(), 'transaction should still be visible')
              t.ok(ok, 'everything should be peachy after setting')

              var selQuery = 'SELECT * FROM ' + TABLE + ' WHERE '
              selQuery += PK + '=' + pkVal + ';'

              clientPool.query(selQuery, function (error, value) {
                if (error) return t.fail(error)

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

        var client = new pg.Client(CON_STRING)
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
            if (error) return t.fail(error)
            var query = client.query(config, [pkVal, colVal], function (error, value) {
              var segment = findSegment(transaction.trace.root,
                'Datastore/statement/Postgres/testTable/insert')
              t.ok(segment, 'expected segment exists')

              client.end()
              t.end()
            })
          })
        })
      })

      t.test("slow queries should have the proper structure", function (t) {
        var client = new pg.Client(CON_STRING)
        helper.runInTransaction(agent, function transactionInScope(tx) {
          var transaction = agent.getTransaction()
          client.connect(function (error) {
            if (error) return t.fail(error)
            client.query('SELECT * FROM pg_sleep(1);', function (error, value) {
              transaction.end(function () {
                client.end()
                verify(t, agent.tracer.getSegment(), 'pg_sleep')
              })
            })
          })
        })
      })

      t.test('query.on should still be chainable', function (t) {
        var client = new pg.Client(CON_STRING)

        client.connect(function (error) {
          if (error) return t.fail(error)
          var query = client.query('SELECT table_name FROM information_schema.tables')

          query.on('error', function(err) {
            t.error(err, 'error while querying')
            t.end()
          }).on('end', function ended() {
            client.end()
            t.end()
          })
        })
      })

      t.test('query.on should not create segments for row events', function (t) {
        helper.runInTransaction(agent, function transactionInScope(tx) {
          var client = new pg.Client(CON_STRING)

          client.connect(function (error) {
            if (error) return t.fail(error)
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
              client.end()
              t.end()
            })
          })
        })
      })

      t.tearDown(function () {
        pg.end()
        helper.unloadAgent(agent)
      })
    }
  })
}
