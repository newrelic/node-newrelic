'use strict'

var test = require('tap').test
var async = require('async')
var params = require('../../lib/params')
var helper = require('../../lib/agent_helper')

// Cassandra driver doesn't have support for v0.8. It uses the stream API introduced
// in v0.10. https://github.com/jorgebay/node-cassandra-cql/issues/11
var semver = require('semver')
if (semver.satisfies(process.versions.node, '<0.10.x')) return

var agent = helper.instrumentMockedAgent()
var cassandra = require('cassandra-driver')

// constants for keyspace and table creation
var KS = 'test'
var FAM = 'testFamily'
var PK = 'pk_column'
var COL = 'test_column'

var client = new cassandra.Client({
  contactPoints: [params.cassandra_host],
  protocolOptions: params.cassandra_port,
  keyspace: KS
})

/**
 * Deletion of testing keyspace if already exists,
 * then recreation of a testable keyspace and table
 *
 *
 * @param Callback function to set off running the tests
 */

function cassSetup(runTest) {
  var setupClient = new cassandra.Client({
    contactPoints: [params.cassandra_host],
    protocolOptions: params.cassandra_port
  })

  var ksDrop = 'DROP KEYSPACE IF EXISTS ' + KS + ';'

  var ksCreate = 'CREATE KEYSPACE ' + KS + ' WITH replication = '
  ksCreate += '{\'class\': \'SimpleStrategy\', \'replication_factor\': 1};'

  var famCreate = 'CREATE TABLE ' + KS + '.' + FAM + ' (' + PK + ' int PRIMARY KEY, '
  famCreate += COL + ' varchar );'

  async.series([drop, createKs, createFam], done)

  function drop(callback) {
    setupClient.execute(ksDrop, callback)
  }

  function createKs(callback) {
    setupClient.execute(ksCreate, callback)
  }

  function createFam(callback) {
    setupClient.execute(famCreate, callback)
  }

  function done(err) {
    if (err) {
     throw err
    }
    setupClient.shutdown()
    runTest()
  }
}

test('Cassandra instrumentation', {timeout: 5000}, function testInstrumentation(t) {
  t.plan(1)
  cassSetup(runTest)

  function runTest() {
    t.test('executeBatch', function (t) {
      t.notOk(agent.getTransaction(), 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        var transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')
        var colValArr = ['Jim', 'Bob', 'Joe']
        var pkValArr = [111, 222, 333]
        var insQuery = 'INSERT INTO ' + KS + '.' + FAM + ' (' + PK + ',' + COL
        insQuery += ') VALUES(?, ?);'

        var insArr = [
          {query: insQuery, params: [pkValArr[0], colValArr[0]]},
          {query: insQuery, params: [pkValArr[1], colValArr[1]]},
          {query: insQuery, params: [pkValArr[2], colValArr[2]]}
        ]

        var hints = [['int', 'varchar'], ['int', 'varchar'], ['int', 'varchar']]

        client.batch(insArr, {hints: hints}, function done(error, ok) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          t.ok(agent.getTransaction(), 'transaction should still be visible')
          t.ok(ok, 'everything should be peachy after setting')

          var selQuery = 'SELECT * FROM ' + KS + '.' + FAM + ' WHERE '
          selQuery += PK + ' = 111;'
          client.execute(selQuery, function (error, value) {
            if (error) return t.fail(error)

            t.ok(
              agent.getTransaction(),
              'transaction should still still be visible'
            )
            t.equals(
              value.rows[0][COL], colValArr[0],
              'Cassandra client should still work'
            )

            var trace = transaction.trace
            t.ok(trace, 'trace should exist')
            t.ok(trace.root, 'root element should exist')
            t.equals(trace.root.children.length, 1,
                   'there should be only one child of the root')

            var setSegment = trace.root.children[0]
            t.ok(setSegment, 'trace segment for insert should exist')
            t.equals(
              setSegment.name,
              'Datastore/statement/Cassandra/test.testFamily/insert/batch',
              'should register the executeBatch'
            )
            t.ok(
              setSegment.children.length >= 2,
              'set should have atleast a dns lookup and callback child'
            )

            var childIndex = setSegment.children.length - 1
            var getSegment = setSegment.children[childIndex].children[0]
            t.ok(getSegment, 'trace segment for select should exist')
            t.equals(
              getSegment.name,
              'Datastore/statement/Cassandra/test.testFamily/select',
              'should register the execute'
            )

            t.ok(
              getSegment.children.length >= 1,
              'get should have a callback segment'
            )

            t.ok(getSegment.timer.hrDuration, 'trace segment should have ended')

            transaction.end(function end() {
              checkMetric('Datastore/operation/Cassandra/insert', 1)
              checkMetric('Datastore/allOther', 2)
              checkMetric('Datastore/Cassandra/allOther', 2)
              checkMetric('Datastore/Cassandra/all', 2)
              checkMetric('Datastore/all', 2)
              checkMetric('Datastore/statement/Cassandra/test.testFamily/insert', 1)
              checkMetric('Datastore/operation/Cassandra/select', 1)
              checkMetric('Datastore/statement/Cassandra/test.testFamily/select', 1)

              t.end()
            })
          })
        })
      })

      function checkMetric(name, count, scoped) {
        var metric = agent.metrics[scoped ? 'scoped' : 'unscoped'][name]
        t.equal(metric.callCount, count)
        t.ok(metric.total, 'should have set total')
        t.ok(metric.totalExclusive, 'should have set totalExclusive')
        t.ok(metric.min, 'should have set min')
        t.ok(metric.max, 'should have set max')
        t.ok(metric.sumOfSquares, 'should have set sumOfSquares')
      }
    })

    t.tearDown(function tearDown() {
      helper.unloadAgent(agent)
      client.shutdown()
    })
  }
})
