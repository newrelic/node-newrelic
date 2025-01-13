/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { removeModules } = require('../../lib/cache-buster')
const { findSegment } = require('../../lib/metrics_helper')
const params = require('../../lib/params')
const helper = require('../../lib/agent_helper')

// constants for keyspace and table creation
const KS = 'test'
const FAM = 'testFamily'
const PK = 'pk_column'
const COL = 'test_column'

const colValArr = ['Jim', 'Bob', 'Joe']
const pkValArr = [111, 222, 333]
const insQuery = `INSERT INTO ${KS}.${FAM} (${PK}, ${COL}) VALUES(?, ?)`

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

const selQuery = `SELECT * FROM ${KS}.${FAM} WHERE ${PK} = 111;`

async function cassSetup(cassandra) {
  const setupClient = new cassandra.Client({
    contactPoints: [params.cassandra_host],
    protocolOptions: params.cassandra_port,
    localDataCenter: 'datacenter1'
  })

  function runCommand(cmd) {
    return new Promise((resolve, reject) => {
      setupClient.execute(cmd, function (err) {
        if (err) {
          return reject(err)
        }

        resolve()
      })
    })
  }

  const ksDrop = `DROP KEYSPACE IF EXISTS ${KS};`
  await runCommand(ksDrop)

  const ksCreate = `CREATE KEYSPACE ${KS} WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};`
  await runCommand(ksCreate)

  const famCreate = `CREATE TABLE ${KS}.${FAM} (${PK} int PRIMARY KEY, ${COL} varchar);`
  await runCommand(famCreate)

  setupClient.shutdown()
}

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent()

  const cassandra = require('cassandra-driver')
  await cassSetup(cassandra)

  ctx.nr.client = new cassandra.Client({
    contactPoints: [params.cassandra_host],
    protocolOptions: params.cassandra_port,
    keyspace: KS,
    localDataCenter: 'datacenter1'
  })
})

test.afterEach((ctx) => {
  ctx.nr.agent.queries.clear()
  ctx.nr.agent.metrics.clear()
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.client.shutdown()
  removeModules(['cassandra-driver'])
})

test('executeBatch - callback style', (t, end) => {
  const { agent, client } = t.nr
  assert.equal(agent.getTransaction(), undefined, 'no transaction should be in play')
  helper.runInTransaction(agent, (tx) => {
    const transaction = agent.getTransaction()
    assert.ok(transaction, 'transaction should be visible')
    assert.equal(tx, transaction, 'we got the same transaction')

    client.batch(insArr, { hints }, (error, ok) => {
      assert.ifError(error, 'should not get an error')

      assert.ok(agent.getTransaction(), 'transaction should still be visible')
      assert.ok(ok, 'everything should be peachy after setting')

      client.execute(selQuery, (error, value) => {
        assert.ifError(error, 'should not get an error')

        assert.ok(agent.getTransaction(), 'transaction should still be visible')
        assert.equal(value.rows[0][COL], colValArr[0], 'cassandra client should still work')

        assert.equal(
          transaction.trace.root.children.length,
          1,
          'there should be only one child of the root'
        )
        verifyTrace(agent, transaction.trace, `${KS}.${FAM}`)
        transaction.end()
        checkMetric(agent)

        end()
      })
    })
  })
})

test('executeBatch - promise style', (t, end) => {
  const { agent, client } = t.nr
  assert.equal(agent.getTransaction(), undefined, 'no transaction should be in play')
  helper.runInTransaction(agent, (tx) => {
    const transaction = agent.getTransaction()
    assert.ok(transaction, 'transaction should be visible')
    assert.equal(tx, transaction, 'we got the same transaction')

    client
      .batch(insArr, { hints })
      .then(() => {
        client
          .execute(selQuery)
          .then((result) => {
            assert.ok(agent.getTransaction(), 'transaction should still be visible')
            assert.equal(result.rows[0][COL], colValArr[0], 'cassandra client should still work')

            assert.equal(
              transaction.trace.root.children.length,
              2,
              'there should be two children of the root'
            )
            verifyTrace(agent, transaction.trace, `${KS}.${FAM}`)
            transaction.end()
            checkMetric(agent)
          })
          .catch((error) => assert.ifError(error))
          .finally(end)
      })
      .catch((error) => assert.ifError(error))
  })
})

test('executeBatch - slow query', (t, end) => {
  const { agent, client } = t.nr
  assert.equal(agent.getTransaction(), undefined, 'no transaction should be in play')
  helper.runInTransaction(agent, (tx) => {
    // enable slow queries
    agent.config.transaction_tracer.explain_threshold = 1
    agent.config.transaction_tracer.record_sql = 'raw'
    agent.config.slow_sql.enabled = true

    const transaction = agent.getTransaction()
    assert.ok(transaction, 'transaction should be visible')
    assert.equal(tx, transaction, 'We got the same transaction')

    client.batch(insArr, { hints }, (error, ok) => {
      assert.ifError(error, 'should not get an error')

      const slowQuery = `SELECT * FROM ${KS}.${FAM}`
      assert.ok(agent.getTransaction(), 'transaction should still be visible')
      assert.ok(ok, 'everything should be peachy after setting')

      client.execute(slowQuery, (error) => {
        assert.ifError(error, 'should not get an error')

        verifyTrace(agent, transaction.trace, `${KS}.${FAM}`)
        transaction.end()
        assert.ok(agent.queries.samples.size > 0, 'there should be a slow query')
        checkMetric(agent)

        end()
      })
    })
  })
})

function checkMetric(agent, scoped) {
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
    if (Object.prototype.hasOwnProperty.call(expected, expectedMetric)) {
      const count = expected[expectedMetric]

      const metric = agentMetrics[scoped ? 'scoped' : 'unscoped'][expectedMetric]
      assert.ok(metric, 'metric "' + expectedMetric + '" should exist')
      if (!metric) {
        return
      }

      assert.equal(metric.callCount, count, 'should be called ' + count + ' times')
      assert.ok(metric.total, 'should have set total')
      assert.ok(metric.totalExclusive, 'should have set totalExclusive')
      assert.ok(metric.min, 'should have set min')
      assert.ok(metric.max, 'should have set max')
      assert.ok(metric.sumOfSquares, 'should have set sumOfSquares')
    }
  }
}

function verifyTrace(agent, trace, table) {
  assert.ok(trace, 'trace should exist')
  assert.ok(trace.root, 'root element should exist')

  const setSegment = findSegment(
    trace.root,
    'Datastore/statement/Cassandra/' + table + '/insert/batch'
  )

  assert.ok(setSegment, 'trace segment for insert should exist')

  if (setSegment) {
    verifyTraceSegment(agent, setSegment, 'insert/batch')

    assert.ok(
      setSegment.children.length >= 2,
      'set should have at least a dns lookup and callback/promise child'
    )

    const getSegment = findSegment(trace.root, 'Datastore/statement/Cassandra/' + table + '/select')
    assert.ok(getSegment, 'trace segment for select should exist')

    if (getSegment) {
      verifyTraceSegment(agent, getSegment, 'select')

      assert.ok(getSegment.children.length >= 1, 'get should have a callback/promise segment')
      assert.ok(getSegment.timer.hrDuration, 'trace segment should have ended')
    }
  }
}

function verifyTraceSegment(agent, segment, queryType) {
  assert.equal(
    segment.name,
    'Datastore/statement/Cassandra/' + KS + '.' + FAM + '/' + queryType,
    'should register the execute'
  )

  const segmentAttributes = segment.getAttributes()
  assert.equal(segmentAttributes.product, 'Cassandra', 'should set product attribute')
  assert.equal(segmentAttributes.port_path_or_id, '9042', 'should set port attribute')
  assert.equal(segmentAttributes.database_name, 'test', 'should set database_name attribute')
  assert.equal(segmentAttributes.host, agent.config.getHostnameSafe(), 'should set host attribute')
}
