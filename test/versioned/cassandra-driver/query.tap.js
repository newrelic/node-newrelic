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
const { findSegment } = require('../../lib/metrics_helper')

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

async function cassSetup() {
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
}

test('Cassandra instrumentation', { timeout: 5000 }, async function testInstrumentation(t) {
  t.before(async function () {
    await cassSetup()
  })

  t.teardown(function tearDown() {
    helper.unloadAgent(agent)
    client.shutdown()
  })

  t.afterEach(() => {
    agent.queries.clear()
    agent.metrics.clear()
  })

  t.test('executeBatch - callback style', function (t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play')
    helper.runInTransaction(agent, function transactionInScope(tx) {
      const transaction = agent.getTransaction()
      t.ok(transaction, 'transaction should be visible')
      t.equal(tx, transaction, 'We got the same transaction')

      client.batch(insArr, { hints: hints }, function done(error, ok) {
        if (error) {
          t.error(error)
          return t.end()
        }

        t.ok(agent.getTransaction(), 'transaction should still be visible')
        t.ok(ok, 'everything should be peachy after setting')

        client.execute(selQuery, function (error, value) {
          if (error) {
            return t.error(error)
          }

          t.ok(agent.getTransaction(), 'transaction should still still be visible')
          t.equal(value.rows[0][COL], colValArr[0], 'Cassandra client should still work')

          t.equal(
            transaction.trace.root.children.length,
            1,
            'there should be only one child of the root'
          )
          verifyTrace(t, transaction.trace, KS + '.' + FAM)
          transaction.end()
          checkMetric(t)
          t.end()
        })
      })
    })
  })

  t.test('executeBatch - promise style', function (t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play')
    helper.runInTransaction(agent, function transactionInScope(tx) {
      const transaction = agent.getTransaction()
      t.ok(transaction, 'transaction should be visible')
      t.equal(tx, transaction, 'We got the same transaction')

      client.batch(insArr, { hints: hints }).then(function () {
        client
          .execute(selQuery)
          .then((result) => {
            t.ok(agent.getTransaction(), 'transaction should still still be visible')
            t.equal(result.rows[0][COL], colValArr[0], 'Cassandra client should still work')

            t.equal(
              transaction.trace.root.children.length,
              2,
              'there should be two children of the root'
            )
            verifyTrace(t, transaction.trace, KS + '.' + FAM)
            transaction.end()
            checkMetric(t)
          })
          .catch((error) => {
            t.error(error)
          })
          .finally(() => {
            t.end()
          })
      })
    })
  })

  t.test('executeBatch - slow query', function (t) {
    t.notOk(agent.getTransaction(), 'no transaction should be in play')
    helper.runInTransaction(agent, function transactionInScope(tx) {
      // enable slow queries
      agent.config.transaction_tracer.explain_threshold = 1
      agent.config.transaction_tracer.record_sql = 'raw'
      agent.config.slow_sql.enabled = true

      const transaction = agent.getTransaction()
      t.ok(transaction, 'transaction should be visible')
      t.equal(tx, transaction, 'We got the same transaction')

      client.batch(insArr, { hints: hints }, function done(error, ok) {
        if (error) {
          t.error(error)
          return t.end()
        }

        const slowQuery = 'SELECT * FROM ' + KS + '.' + FAM
        t.ok(agent.getTransaction(), 'transaction should still be visible')
        t.ok(ok, 'everything should be peachy after setting')

        client.execute(slowQuery, function (error) {
          if (error) {
            return t.error(error)
          }

          verifyTrace(t, transaction.trace, KS + '.' + FAM)
          transaction.end()
          t.ok(agent.queries.samples.size > 0, 'there should be a slow query')
          checkMetric(t)
          t.end()
        })
      })
    })
  })

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
      'Datastore/statement/Cassandra/test.testFamily/select': 1
    }

    for (const expectedMetric in expected) {
      if (expected.hasOwnProperty(expectedMetric)) {
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
  }

  function verifyTrace(t, trace, table) {
    t.ok(trace, 'trace should exist')
    t.ok(trace.root, 'root element should exist')

    const setSegment = findSegment(
      trace.root,
      'Datastore/statement/Cassandra/' + table + '/insert/batch'
    )

    t.ok(setSegment, 'trace segment for insert should exist')

    if (setSegment) {
      verifyTraceSegment(t, setSegment, 'insert/batch')

      t.ok(
        setSegment.children.length >= 2,
        'set should have at least a dns lookup and callback/promise child'
      )

      const getSegment = findSegment(
        trace.root,
        'Datastore/statement/Cassandra/' + table + '/select'
      )
      t.ok(getSegment, 'trace segment for select should exist')

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
    t.equal(segmentAttributes.database_name, 'test', 'should set database_name attribute')
    t.equal(segmentAttributes.host, agent.config.getHostnameSafe(), 'should set host attribute')
  }
})
