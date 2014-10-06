'use strict'

var path   = require('path')
  , tap    = require('tap')
  , async  = require('async')
  , params = require('../../lib/params')
  , test   = tap.test
  , helper = require('../../lib/agent_helper')
  

var agent      = helper.instrumentMockedAgent()
  , cassandra  = require('node-cassandra-cql')
  , client     = new cassandra.Client({hosts: [params.cassandra_host  + ":"
    + params.cassandra_port]})

//constants for keyspace and table creation
var KS  = 'test'
  , FAM = 'testFamily'
  , PK  = 'pk_column'
  , COL = 'test_column'


/**
 * Deletion of testing keyspace if already exists,
 * then recreation of a testable keyspace and table
 *
 *
 * @param Callback function to set off running the tests
 */
function cassSetup (runTest) {

  var setupClient = new cassandra.Client({hosts: [params.cassandra_host  + ":"
    + params.cassandra_port]})

  var ksDrop = 'DROP KEYSPACE IF EXISTS ' + KS + ';'

  var ksCreate = 'CREATE KEYSPACE ' + KS + " WITH replication = "
  ksCreate += "{'class': 'SimpleStrategy', 'replication_factor' : 1};"

  var famCreate = 'CREATE TABLE ' + KS + '.' + FAM + ' (' + PK + ' int PRIMARY KEY, '
  famCreate += COL + ' varchar );'

  async.series(
    [
      function (callback) {
        setupClient.execute(ksDrop, callback)
      },
      function (callback) {
        setupClient.execute(ksCreate, callback)
      },
      function (callback) {
        setupClient.execute(famCreate, callback)
      }
    ],
    function(err, results) {
      if (err) {
       throw err
      }
      setupClient.shutdown()
      runTest()
    }
  )
}


test("Cassandra instrumentation",
    {timeout : 5000},
      function (t) {
        t.plan(2)
  cassSetup(runTest)
  function runTest () {

    t.test("executeBatch", function (t) {
      t.notOk(agent.getTransaction(), "no transaction should be in play")
      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction()
        t.ok(transaction, "transaction should be visible")
        t.equal(tx, transaction, 'We got the same transaction')
        var colValArr = ['Jim', 'Bob', 'Joe']
        var pkValArr = [111, 222, 333]
        var insQuery = 'INSERT INTO ' + KS + '.' + FAM + ' (' + PK + ',' +  COL
        insQuery += ') VALUES(?, ?);'

        var insArr = [
          {
            query: insQuery,
            params: [pkValArr[0], colValArr[0]]
          },
          {
            query: insQuery,
            params: [pkValArr[1], colValArr[1]]
          },
          {
            query: insQuery,
            params: [pkValArr[2], colValArr[2]]
          },
        ]

        client.executeBatch(insArr, function (error, ok) {
          if (error) return t.fail(error)

          t.ok(agent.getTransaction(), "transaction should still be visible")
          t.ok(ok, "everything should be peachy after setting")

          var selQuery = 'SELECT * FROM ' + KS + '.' + FAM + ' WHERE '
          selQuery += PK + ' = 111;'
          client.execute(selQuery, function (error, value) {
            if (error) return t.fail(error)

            t.ok(agent.getTransaction(), "transaction should still still be visible")
            t.equals(value.rows[0][COL], colValArr[0], "Cassandra client should still work")

            transaction.end()

            setImmediate(function() {
              var trace = transaction.getTrace()
              t.ok(trace, "trace should exist")
              t.ok(trace.root, "root element should exist")
              t.equals(trace.root.children.length, 1,
                     "there should be only one child of the root")
              var setSegment = trace.root.children[0]
              t.ok(setSegment, "trace segment for insert should exist")
              t.equals(setSegment.name, "Datastore/operation/Cassandra/executeBatch",
                     "should register the executeBatch")
              t.equals(setSegment.children.length, 1,
                     "set should have an only child")
              var getSegment = setSegment.children[0]
              t.ok(getSegment, "trace segment for select should exist")
              t.equals(getSegment.name, "Datastore/operation/Cassandra/execute",
                     "should register the execute")
              t.equals(getSegment.children.length, 0,
                     "get should leave us here at the end")
              t.ok(getSegment._isEnded(), "trace segment should have ended")

              t.end()
            })
          })
        })
      })
    })

    t.test('executeAsPrepared', function (t) {
      t.notOk(agent.getTransaction(), "no transaction should be in play")
      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction()
        t.ok(transaction, "transaction should be visible")
        t.equal(tx, transaction, 'We got the same transaction')
        var colVal = 'Jim'
        var pkVal = 444
        var insQuery = 'INSERT INTO ' + KS + '.' + FAM + ' (' + PK + ',' +  COL
        insQuery += ') VALUES(?, ?);'
        client.executeAsPrepared(insQuery, [pkVal, colVal], function (error, ok) {
          if (error) return t.fail(error)

          t.ok(agent.getTransaction(), "transaction should still be visible")
          t.ok(ok, "everything should be peachy after setting")

          var selQuery = 'SELECT * FROM ' + KS + '.' + FAM + ' WHERE '
          selQuery += PK + ' = ' + pkVal + ';'
          client.execute(selQuery, function (error, value) {
            if (error) return t.fail(error)
            t.ok(agent.getTransaction(), "transaction should still still be visible")
            t.equals(value.rows[0][COL], colVal, "Cassandra client should still work")

            transaction.end()

            setImmediate(function() {
              var trace = transaction.getTrace()
              t.ok(trace, "trace should exist")
              t.ok(trace.root, "root element should exist")
              t.equals(trace.root.children.length, 1,
                     "there should be only one child of the root")
              var setSegment = trace.root.children[0]
              t.ok(setSegment, "trace segment for set should exist")
              t.equals(setSegment.name, "Datastore/operation/Cassandra/executeAsPrepared",
                     "should register the executeAsPrepared")
              t.equals(setSegment.children.length, 1,
                     "set should have an only child")
              var getSegment = setSegment.children[0]
              t.ok(getSegment, "trace segment for get should exist")
              t.equals(getSegment.name, "Datastore/operation/Cassandra/execute",
                     "should register the execute")
              t.equals(getSegment.children.length, 0,
                     "get should leave us here at the end")
              t.ok(getSegment._isEnded(), "trace segment should have ended")

              t.end()
            })
          })
        })
      })
    })

    t.tearDown(function () {
      helper.unloadAgent(agent)
      client.shutdown()

    })
  }
})
