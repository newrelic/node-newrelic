/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const async = require('async')
const params = require('../../lib/params')
const helper = require('../../lib/agent_helper')

const agent = helper.instrumentMockedAgent()
const cassandra = require('cassandra-driver')

// constants for keyspace and table creation
const KS = 'test'
const FAM = 'testFamily'
const PK = 'pk_column'
const COL = 'test_column'

const client = new cassandra.Client({
  contactPoints: [params.cassandra_host],
  protocolOptions: params.cassandra_port,
  keyspace: KS,
  localDataCenter: 'datacenter1'
})

/**
 * Deletion of testing keyspace if already exists,
 * then recreation of a testable keyspace and table
 *
 *
 * @param Callback function to set off running the tests
 */

function cassSetup(runTest) {
  const setupClient = new cassandra.Client({
    contactPoints: [params.cassandra_host],
    protocolOptions: params.cassandra_port,
    localDataCenter: 'datacenter1'
  })

  const ksDrop = 'DROP KEYSPACE IF EXISTS ' + KS + ';'

  let ksCreate = 'CREATE KEYSPACE ' + KS + ' WITH replication = '
  ksCreate += "{'class': 'SimpleStrategy', 'replication_factor': 1};"

  let famCreate = 'CREATE TABLE ' + KS + '.' + FAM + ' (' + PK + ' int PRIMARY KEY, '
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

test('Cassandra instrumentation', { timeout: 5000 }, function testInstrumentation(t) {
  t.plan(1)
  cassSetup(runTest)

  function runTest() {
    t.test('executeBatch', function (t) {
      t.notOk(agent.getTransaction(), 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        const transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')
        const colValArr = ['Jim', 'Bob', 'Joe']
        const pkValArr = [111, 222, 333]
        let insQuery = 'INSERT INTO ' + KS + '.' + FAM + ' (' + PK + ',' + COL
        insQuery += ') VALUES(?, ?);'

        const insArr = [
          { query: insQuery, params: [pkValArr[0], colValArr[0]] },
          { query: insQuery, params: [pkValArr[1], colValArr[1]] },
          { query: insQuery, params: [pkValArr[2], colValArr[2]] }
        ]

        const hints = [
          ['int', 'varchar'],
          ['int', 'varchar'],
          ['int', 'varchar']
        ]

        client.batch(insArr, { hints: hints }, function done(error, ok) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          t.ok(agent.getTransaction(), 'transaction should still be visible')
          t.ok(ok, 'everything should be peachy after setting')

          let selQuery = 'SELECT * FROM ' + KS + '.' + FAM + ' WHERE '
          selQuery += PK + ' = 111;'
          client.execute(selQuery, function (error, value) {
            if (error) {
              return t.fail(error)
            }

            t.ok(agent.getTransaction(), 'transaction should still still be visible')
            t.equal(value.rows[0][COL], colValArr[0], 'Cassandra client should still work')

            const trace = transaction.trace
            t.ok(trace, 'trace should exist')
            t.ok(trace.root, 'root element should exist')

            t.equal(trace.root.children.length, 1, 'there should be only one child of the root')

            const setSegment = trace.root.children[0]
            t.ok(setSegment, 'trace segment for insert should exist')
            if (setSegment) {
              t.equal(
                setSegment.name,
                'Datastore/statement/Cassandra/test.testFamily/insert/batch',
                'should register the executeBatch'
              )
              t.ok(
                setSegment.children.length >= 2,
                'set should have atleast a dns lookup and callback child'
              )

              const childIndex = setSegment.children.length - 1
              const getSegment = setSegment.children[childIndex].children[0]
              t.ok(getSegment, 'trace segment for select should exist')
              if (getSegment) {
                t.equal(
                  getSegment.name,
                  'Datastore/statement/Cassandra/test.testFamily/select',
                  'should register the execute'
                )

                t.ok(getSegment.children.length >= 1, 'get should have a callback segment')
                t.ok(getSegment.timer.hrDuration, 'trace segment should have ended')
              }
            }

            transaction.end()
            checkMetric('Datastore/operation/Cassandra/insert', 1)
            checkMetric('Datastore/allWeb', 2)
            checkMetric('Datastore/Cassandra/allWeb', 2)
            checkMetric('Datastore/Cassandra/all', 2)
            checkMetric('Datastore/all', 2)
            checkMetric('Datastore/statement/Cassandra/test.testFamily/insert', 1)
            checkMetric('Datastore/operation/Cassandra/select', 1)
            checkMetric('Datastore/statement/Cassandra/test.testFamily/select', 1)

            t.end()
          })
        })
      })

      function checkMetric(name, count, scoped) {
        const agentMetrics = agent.metrics._metrics
        const metric = agentMetrics[scoped ? 'scoped' : 'unscoped'][name]
        t.ok(metric, 'metric "' + name + '" should exist')
        if (!metric) {
          return
        }

        t.equal(metric.callCount, count, 'should be called ' + count + ' times')
        t.ok(metric.total, 'should have set total')
        t.ok(metric.totalExclusive, 'should have set totalExclusive')
        t.ok(metric.min, 'should have set min')
        t.ok(metric.max, 'should have set max')
        t.ok(metric.sumOfSquares, 'should have set sumOfSquares')
      }
    })

    t.teardown(function tearDown() {
      helper.unloadAgent(agent)
      client.shutdown()
    })
  }
})
