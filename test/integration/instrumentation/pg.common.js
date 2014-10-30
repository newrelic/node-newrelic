'use strict'

var tap    = require('tap')
  , params = require('../../lib/params')
  , helper = require('../../lib/agent_helper')
  , test   = tap.test


module.exports = function runTests(agent, pg, name) {
  //constants for table creation and db connection
  var TABLE      = 'testTable'
    , PK         = 'pk_column'
    , COL        = 'test_column'
    , CON_STRING = 'postgres://' + params.postgres_user + ':' + params.postgres_pass + '@'
        + params.postgres_host + ':' + params.postgres_port + '/' + params.postgres_db

  /**
   * Deletion of testing table if already exists,
   * then recreation of a testing table
   *
   *
   * @param Callback function to set off running the tests
   */
  function postgresSetup (runTest) {
    var setupClient = new pg.Client(CON_STRING)

    setupClient.connect(function (error) {
      if (error) {
        throw error
      }
      var tableDrop = 'DROP TABLE IF EXISTS ' + TABLE

      var tableCreate = 'CREATE TABLE ' + TABLE + ' (' + PK + ' integer PRIMARY KEY, '
      tableCreate += COL + ' text);'

      setupClient.query(tableDrop, function (error) {
        if (error) {
          throw error
        }
        setupClient.query(tableCreate, function (error) {
          if (error) {
            throw error
          }
          setupClient.end()
          runTest()
        })
      })
    })
   }

  function verify(t, transaction) {
    setImmediate(function() {
      t.equal(Object.keys(transaction.metrics.scoped).length, 0, 'should not have any scoped metrics')

      var unscoped = transaction.metrics.unscoped

      var expected = {
        'Datastore/all': 2,
        'Datastore/allOther': 2,
        'Datastore/operation/Postgres/insert': 1,
        'Datastore/operation/Postgres/select': 1,
      }

      expected['Datastore/statement/Postgres/' + TABLE + '/insert'] = 1
      expected['Datastore/statement/Postgres/' + TABLE + '/select'] = 1

      if (name !== 'pure JavaScript') {
        expected['Datastore/instance/Postgres/' + params.postgres_host + ':' + params.postgres_port] = 2
      }

      var expectedNames = Object.keys(expected)
      var unscopedNames = Object.keys(unscoped)

      expectedNames.forEach(function (name) {
        t.ok(unscoped[name], 'should have unscoped metric ' + name)
        if (unscoped[name]) {
          t.equals(unscoped[name].callCount, expected[name], 'metric ' + name + ' should have correct callCount')
        }
      })

      t.equals(unscopedNames.length, expectedNames.length, 'should have correct number of unscoped metrics')

      var trace = transaction.getTrace()
      t.ok(trace, 'trace should exist')
      t.ok(trace.root, 'root element should exist')
      t.equals(trace.root.children.length, 1,
               'there should be only one child of the root')
      var setSegment = trace.root.children[0]

      if (name !== 'pure JavaScript') {
        t.equals(setSegment.host, params.postgres_host, 'should register the host')
        t.equals(setSegment.port, params.postgres_port, 'should register the port')
      } else {
        t.skip('should register the host (unsupported for pure JS right now)')
        t.skip('should register the port (unsupported for pure JS right now)')
      }

      t.ok(setSegment, 'trace segment for insert should exist')
      t.equals(setSegment.name, 'Datastore/statement/Postgres/' + TABLE + '/insert',
               'should register the query call')
      t.equals(setSegment.children.length, 1,
               'set should have an only child')
      var getSegment = setSegment.children[0]
      t.ok(getSegment, 'trace segment for select should exist')

      if (!getSegment) return t.end()

      t.equals(getSegment.name, 'Datastore/statement/Postgres/' + TABLE + '/select',
               'should register the query call')
      t.equals(getSegment.children.length, 0,
               'get should leave us here at the end')
      t.ok(getSegment._isEnded(), 'trace segment should have ended')

      t.end()
    })
  }

  test('Postgres instrumentation: ' + name, function (t) {
    t.plan(5)
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
                  verify(t, transaction)
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
                  verify(t, transaction)
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
                  verify(t, transaction)
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
                  verify(t, transaction)
                })
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

      t.tearDown(function () {
        pg.end()
        helper.unloadAgent(agent)
      })
    }
  })
}
