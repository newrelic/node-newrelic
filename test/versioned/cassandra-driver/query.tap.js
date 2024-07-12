/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
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

let selQuery = 'SELECT * FROM ' + KS + '.' + FAM + ' WHERE '
selQuery += PK + ' = 111;'

/**
 * Deletion of testing keyspace if already exists,
 * then recreation of a testable keyspace and table
 *
 *
 * @param Callback function to set off running the tests
 */

async function cassSetup(runTest) {
  const setupClient = new cassandra.Client({
    contactPoints: [params.cassandra_host],
    protocolOptions: params.cassandra_port,
    localDataCenter: 'datacenter1'
  })

  function runCommand(cmd) {
    return new Promise((resolve, reject) => {
      setupClient.execute(cmd, function (err) {
        if (err) {
          reject(err)
        }

        resolve()
      })
    })
  }

  const ksDrop = 'DROP KEYSPACE IF EXISTS ' + KS + ';'
  await runCommand(ksDrop)

  let ksCreate = 'CREATE KEYSPACE ' + KS + ' WITH replication = '
  ksCreate += "{'class': 'SimpleStrategy', 'replication_factor': 1};"

  await runCommand(ksCreate)

  let famCreate = 'CREATE TABLE ' + KS + '.' + FAM + ' (' + PK + ' int PRIMARY KEY, '
  famCreate += COL + ' varchar );'

  await runCommand(famCreate)

  setupClient.shutdown()
  runTest()
}

test('Cassandra instrumentation', { timeout: 5000 }, async function testInstrumentation(t) {
  t.plan(2)
  await cassSetup(runTest)

  function runTest() {
    // t.test('executeBatch - callback style', function (t) {
    //   t.notOk(agent.getTransaction(), 'no transaction should be in play')
    //   helper.runInTransaction(agent, function transactionInScope(tx) {
    //     const transaction = agent.getTransaction()
    //     t.ok(transaction, 'transaction should be visible')
    //     t.equal(tx, transaction, 'We got the same transaction')

    //     client.batch(insArr, { hints: hints }, function done(error, ok) {
    //       if (error) {
    //         t.fail(error)
    //         return t.end()
    //       }

    //       t.ok(agent.getTransaction(), 'transaction should still be visible')
    //       t.ok(ok, 'everything should be peachy after setting')

    //       client.execute(selQuery, function (error, value) {
    //         if (error) {
    //           return t.fail(error)
    //         }

    //         t.ok(agent.getTransaction(), 'transaction should still still be visible')
    //         t.equal(value.rows[0][COL], colValArr[0], 'Cassandra client should still work')

    //         t.equal(transaction.trace.root.children.length, 1, 'there should be only one child of the root')
    //         verifyTrace(t, transaction.trace)
    //         transaction.end()
    //         checkMetric(t);
    //         t.end()
    //       })
    //     })
    //   })
    // })

    // t.test('executeBatch promise style', function (t) {
    //   t.notOk(agent.getTransaction(), 'no transaction should be in play')
    //   helper.runInTransaction(agent, function transactionInScope(tx) {
    //     const transaction = agent.getTransaction()
    //     t.ok(transaction, 'transaction should be visible')
    //     t.equal(tx, transaction, 'We got the same transaction')

    //     client.batch(insArr, { hints: hints }).then(function (_) {
    //       client.execute(selQuery)
    //       .then(result => {
    //         t.ok(agent.getTransaction(), 'transaction should still still be visible')
    //         t.equal(result.rows[0][COL], colValArr[0], 'Cassandra client should still work')

    //         t.equal(transaction.trace.root.children.length, 2, 'there should be two children of the root')
    //         verifyTrace(t, transaction.trace)
    //         checkMetric(t);
    //       })
    //       .catch(error => {
    //         t.fail(error)
    //       })
    //       .finally(() => {
    //         transaction.end()
    //         t.end()
    //       })
    //     })
    //   })
    // })

    t.test('executeBatch - slow query', function (t) {
      t.notOk(agent.getTransaction(), 'no transaction should be in play')
      helper.runInTransaction(agent, function transactionInScope(tx) {
        // enable slow queries
        agent.config.transaction_tracer.record_sql = 'raw'
        agent.config.slow_sql.enabled = true

        const transaction = agent.getTransaction()
        t.ok(transaction, 'transaction should be visible')
        t.equal(tx, transaction, 'We got the same transaction')

        client.batch(insArr, { hints: hints }, function done(error, ok) {
          if (error) {
            t.fail(error)
            return t.end()
          }

          const testSelQuery = 'SELECT * FROM ' + KS + '.' + FAM

          t.ok(agent.getTransaction(), 'transaction should still be visible')
          t.ok(ok, 'everything should be peachy after setting')

          client.execute(testSelQuery, function (error, value) {
            if (error) {
              return t.fail(error)
            }

            t.equal(agent.queries.samples.size, 1, 'should have one slow query')
            transaction.end()
            checkMetric(t);
            t.end()
          })
        })
      })
    })


    // t.test('executeBatch - query with streaming', function (t) {
    //   t.notOk(agent.getTransaction(), 'no transaction should be in play')
    //   helper.runInTransaction(agent, function transactionInScope(tx) {
    //     const transaction = agent.getTransaction()
    //     t.ok(transaction, 'transaction should be visible')
    //     t.equal(tx, transaction, 'We got the same transaction')

    //     client.batch(insArr, { hints: hints }, function done(error, ok) {
    //       if (error) {
    //         t.fail(error)
    //         return t.end()
    //       }

    //       t.ok(agent.getTransaction(), 'transaction should still be visible')
    //       t.ok(ok, 'everything should be peachy after setting')

    //       const selQuery = 'SELECT * FROM ' + KS + '.' + FAM
    //       let rowCount = 0

    //       client.stream(selQuery, [], { prepare: true })
    //       .on('readable', function () {
    //         let row
    //         while (row = this.read()) {
    //           rowCount++
    //           t.ok(row, 'Row should be received')
    //         }
    //       })
    //       .on('end', function () {
    //         t.ok(agent.getTransaction(), 'transaction should still be visible')
    //         t.equal(rowCount, 3, 'Three rows should have been received')
    //         t.equal(transaction.trace.root.children.length, 1, 'there should be only one child of the root')
    //         verifyTrace(t, transaction.trace)
    //         transaction.end()
    //         checkMetric(t)
    //         t.end()
    //       })
    //       .on('error', function (err) {
    //         t.fail(err)
    //         t.end()
    //       })
    //     })
    //   })
    // })

    function checkMetric(t, scoped) {
      const agentMetrics = agent.metrics._metrics

      const expected = {
        'Datastore/operation/Cassandra/insert': 1,
        'Datastore/allWeb': 2,
        'Datastore/Cassandra/allWeb': 2,
        'Datastore/Cassandra/all': 2,
        'Datastore/all': 2,
        'Datastore/statement/Cassandra/test.testFamily/insert': 1,
        'Datastore/operation/Cassandra/select': 1,
        'Datastore/statement/Cassandra/test.testFamily/select': 1,
      }

      for ( const expectedMetric in expected) {
        const count = expected[expectedMetric]

        const metric = agentMetrics[scoped ? 'scoped' : 'unscoped'][expectedMetric]
        t.ok(metric, 'metric "' + expectedMetric + '" should exist')
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
    }

    function verifyTrace(t, trace) {
      t.ok(trace, 'trace should exist')
      t.ok(trace.root, 'root element should exist')

      const setSegment = trace.root.children[0]
      t.ok(setSegment, 'trace segment for insert should exist')

      if (setSegment) {
        verifyTraceSegment(t, setSegment, 'insert/batch')

        t.ok(
          setSegment.children.length >= 2,
          'set should have atleast a dns lookup and callback child'
        )

        const childIndex = setSegment.children.length - 1
        const getSegment = setSegment.children[childIndex].children[0]

        // why is there no setSegment for promise style query execution
        // t.ok(getSegment, 'trace segment for select should exist')

        if (getSegment) {
          verifyTraceSegment(t, getSegment, 'select')

          t.ok(getSegment.children.length >= 1, 'get should have a callback segment')
          t.ok(getSegment.timer.hrDuration, 'trace segment should have ended')
        }
      }
    }

    function verifyTraceSegment(t, segment, queryType) {
      t.equal(
        segment.name,
        'Datastore/statement/Cassandra/test.testFamily/' + queryType,
        'should register the execute'
      )

      const segmentAttributes = segment.getAttributes()
      t.equal(segmentAttributes.product, 'Cassandra', 'should set product attribute')
      t.equal(segmentAttributes.port_path_or_id, '9042', 'should set port attribute')
      t.equal(
        segmentAttributes.database_name,
        'test',
        'should set database_name attribute'
      )
      t.equal(
        segmentAttributes.host,
        agent.config.getHostnameSafe(),
        'should set host attribute'
      )
    }

    t.teardown(function tearDown() {
      helper.unloadAgent(agent)
      client.shutdown()
    })
  }
})