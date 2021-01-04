/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const helper = require('../lib/agent_helper')
const Transaction = require('../../lib/transaction')
const ParsedStatement = require('../../lib/db/parsed-statement')


function checkMetric(t, metrics, name, scope) {
  t.match(metrics.getMetric(name, scope), {'total': 0.333})
}

tap.test('recording database metrics', (t) => {
  t.autoend()

  let agent = null
  let metrics = null

  t.test('setup', (t) => {
    agent = helper.loadMockedAgent()
    t.end()
  })

  t.test('on scoped transactions with parsed statements - with collection', (t) => {
    t.test('with collection', (t) => {
      t.beforeEach((done) => {
        let ps          = new ParsedStatement('NoSQL', 'select', 'test_collection')
        let transaction = new Transaction(agent)
        let segment     = transaction.trace.add('test')

        transaction.type = Transaction.TYPES.BG
        segment.setDurationInMillis(333)
        ps.recordMetrics(segment, 'TEST')
        transaction.end()

        metrics = transaction.metrics

        done()
      })

      t.test('should find 1 scoped metric', (t) => {
        t.equal(metrics._toScopedData().length, 1)
        t.end()
      })

      t.test('should find 6 unscoped metrics', (t) => {
        t.equal(metrics._toUnscopedData().length, 6)
        t.end()
      })

      t.test('should find a scoped metric on the table and operation', (t) => {
        checkMetric(t, metrics, 'Datastore/statement/NoSQL/test_collection/select', 'TEST')
        t.end()
      })

      t.test('should find an unscoped metric on the table and operation', (t) => {
        checkMetric(t, metrics, 'Datastore/statement/NoSQL/test_collection/select')
        t.end()
      })

      t.test('should find an unscoped rollup metric on the operation', (t) => {
        checkMetric(t, metrics, 'Datastore/operation/NoSQL/select')
        t.end()
      })

      t.test('should find a database rollup metric', (t) => {
        checkMetric(t, metrics, 'Datastore/all')
        t.end()
      })

      t.test('should find a database rollup metric of type `Other`', (t) => {
        checkMetric(t, metrics, 'Datastore/allOther')
        t.end()
      })

      t.test('should find a database type rollup metric of type `All`', (t) => {
        checkMetric(t, metrics, 'Datastore/NoSQL/all')
        t.end()
      })

      t.test('should find a database type rollup metric of type `Other`', (t) => {
        checkMetric(t, metrics, 'Datastore/NoSQL/allOther')
        t.end()
      })

      t.end()
    })

    t.test('without collection', (t) => {
      t.beforeEach((done) => {
        let ps          = new ParsedStatement('NoSQL', 'select')
        let transaction = new Transaction(agent)
        let segment     = transaction.trace.add('test')

        transaction.type = Transaction.TYPES.BG
        segment.setDurationInMillis(333)
        ps.recordMetrics(segment, 'TEST')
        transaction.end()

        metrics = transaction.metrics

        done()
      })

      t.test('should find 1 scoped metric', (t) => {
        t.equal(metrics._toScopedData().length, 1)
        t.end()
      })

      t.test('should find 5 unscoped metrics', (t) => {
        t.equal(metrics._toUnscopedData().length, 5)
        t.end()
      })

      t.test('should find a scoped metric on the operation', (t) => {
        checkMetric(t, metrics, 'Datastore/operation/NoSQL/select', 'TEST')
        t.end()
      })

      t.test('should find an unscoped metric on the operation', (t) => {
        checkMetric(t, metrics, 'Datastore/operation/NoSQL/select')
        t.end()
      })

      t.test('should find a database rollup metric', (t) => {
        checkMetric(t, metrics, 'Datastore/all')
        t.end()
      })

      t.test('should find a database rollup metric of type `Other`', (t) => {
        checkMetric(t, metrics, 'Datastore/allOther')
        t.end()
      })

      t.test('should find a database type rollup metric of type `All`', (t) => {
        checkMetric(t, metrics, 'Datastore/NoSQL/all')
        t.end()
      })

      t.test('should find a database type rollup metric of type `Other`', (t) => {
        checkMetric(t, metrics, 'Datastore/NoSQL/allOther')
        t.end()
      })

      t.end()
    })

    t.end()
  })

  t.test('reset', (t) => {
    helper.unloadAgent(agent)
    agent = helper.loadMockedAgent()
    t.end()
  })

  t.test('on unscoped transactions with parsed statements', (t) => {
    t.test('with collection', (t) => {
      t.beforeEach((done) => {
        let ps          = new ParsedStatement('NoSQL', 'select', 'test_collection')
        let transaction = new Transaction(agent)
        let segment     = transaction.trace.add('test')

        transaction.type = Transaction.TYPES.BG
        segment.setDurationInMillis(333)
        ps.recordMetrics(segment, null)
        transaction.end()

        metrics = transaction.metrics

        done()
      })

      t.test('should find 0 unscoped metrics', (t) => {
        t.equal(metrics._toScopedData().length, 0)
        t.end()
      })

      t.test('should find 6 unscoped metrics', (t) => {
        t.equal(metrics._toUnscopedData().length, 6)
        t.end()
      })

      t.test('should find an unscoped metric on the table and operation', (t) => {
        checkMetric(t, metrics, 'Datastore/statement/NoSQL/test_collection/select')
        t.end()
      })

      t.test('should find an unscoped rollup metric on the operation', (t) => {
        checkMetric(t, metrics, 'Datastore/operation/NoSQL/select')
        t.end()
      })

      t.test('should find an unscoped rollup DB metric', (t) => {
        checkMetric(t, metrics, 'Datastore/all')
        t.end()
      })

      t.test('should find an unscoped rollup DB metric of type `Other`', (t) => {
        checkMetric(t, metrics, 'Datastore/allOther')
        t.end()
      })

      t.test('should find a database type rollup metric of type `All`', (t) => {
        checkMetric(t, metrics, 'Datastore/NoSQL/all')
        t.end()
      })

      t.test('should find a database type rollup metric of type `Other`', (t) => {
        checkMetric(t, metrics, 'Datastore/NoSQL/allOther')
        t.end()
      })

      t.end()
    })

    t.test('without collection', (t) => {
      t.beforeEach((done) => {
        let ps          = new ParsedStatement('NoSQL', 'select')
        let transaction = new Transaction(agent)
        let segment     = transaction.trace.add('test')

        transaction.type = Transaction.TYPES.BG
        segment.setDurationInMillis(333)
        ps.recordMetrics(segment, null)
        transaction.end()

        metrics = transaction.metrics

        done()
      })

      t.test('should find 0 unscoped metrics', (t) => {
        t.equal(metrics._toScopedData().length, 0)
        t.end()
      })

      t.test('should find 5 unscoped metrics', (t) => {
        t.equal(metrics._toUnscopedData().length, 5)
        t.end()
      })

      t.test('should find an unscoped metric on the operation', (t) => {
        checkMetric(t, metrics, 'Datastore/operation/NoSQL/select')
        t.end()
      })

      t.test('should find an unscoped rollup DB metric', (t) => {
        checkMetric(t, metrics, 'Datastore/all')
        t.end()
      })

      t.test('should find an unscoped rollup DB metric of type `Other`', (t) => {
        checkMetric(t, metrics, 'Datastore/allOther')
        t.end()
      })

      t.test('should find a database type rollup metric of type `All`', (t) => {
        checkMetric(t, metrics, 'Datastore/NoSQL/all')
        t.end()
      })

      t.test('should find a database type rollup metric of type `Other`', (t) => {
        checkMetric(t, metrics, 'Datastore/NoSQL/allOther')
        t.end()
      })

      t.end()
    })

    t.end()
  })

  t.test('teardown', (t) => {
    helper.unloadAgent(agent)
    t.end()
  })
})

tap.test('recording slow queries', (t) => {
  t.autoend()

  t.test('with collection', (t) => {
    let transaction
    let segment
    let agent

    t.beforeEach((done) => {
      agent = helper.loadMockedAgent({
        slow_sql: {enabled: true},
        transaction_tracer: {
          record_sql: 'obfuscated'
        }
      })

      let ps = new ParsedStatement(
        'MySql',
        'select',
        'foo',
        'select * from foo where b=1'
      )

      transaction = new Transaction(agent)
      transaction.type = Transaction.TYPES.BG
      segment = transaction.trace.add('test')

      segment.setDurationInMillis(503)
      ps.recordMetrics(segment, 'TEST')

      let ps2 = new ParsedStatement(
        'MySql',
        'select',
        'foo',
        'select * from foo where b=2'
      )

      let segment2 = transaction.trace.add('test')
      segment2.setDurationInMillis(501)
      ps2.recordMetrics(segment2, 'TEST')

      transaction.end()

      done()
    })

    t.afterEach((done) => {
      helper.unloadAgent(agent)
      done()
    })

    t.test('should update segment names', (t) => {
      t.equal(segment.name, 'Datastore/statement/MySql/foo/select')
      t.end()
    })

    t.test('should capture queries', (t) => {
      t.equal(agent.queries.samples.size, 1)

      let sample = agent.queries.samples.values().next().value
      let trace = sample.trace

      t.equal(sample.total, 1004)
      t.equal(sample.totalExclusive, 1004)
      t.equal(sample.min, 501)
      t.equal(sample.max, 503)
      t.equal(sample.sumOfSquares, 504010)
      t.equal(sample.callCount, 2)
      t.equal(trace.obfuscated, 'select * from foo where b=?')
      t.equal(trace.normalized, 'select*fromfoowhereb=?')
      t.equal(trace.id, 75330402683074160)
      t.equal(trace.query, 'select * from foo where b=1')
      t.equal(trace.metric, 'Datastore/statement/MySql/foo/select')
      t.equal(typeof trace.trace, 'string')

      t.end()
    })

    t.end()
  })

  t.test('without collection', (t) => {
    let transaction
    let segment
    let agent

    t.beforeEach((done) => {
      agent = helper.loadMockedAgent({
        slow_sql: {enabled: true},
        transaction_tracer: {
          record_sql: 'obfuscated'
        }
      })

      let ps = new ParsedStatement(
        'MySql',
        'select',
        null,
        'select * from foo where b=1'
      )

      transaction = new Transaction(agent)
      segment = transaction.trace.add('test')

      segment.setDurationInMillis(503)
      ps.recordMetrics(segment, 'TEST')

      let ps2 = new ParsedStatement(
        'MySql',
        'select',
        null,
        'select * from foo where b=2'
      )

      let segment2 = transaction.trace.add('test')
      segment2.setDurationInMillis(501)
      ps2.recordMetrics(segment2, 'TEST')

      transaction.end()

      done()
    })

    t.afterEach((done) => {
      helper.unloadAgent(agent)
      agent = null
      done()
    })

    t.test('should update segment names', (t) => {
      t.equal(segment.name, 'Datastore/operation/MySql/select')
      t.end()
    })

    t.test('should have IDs that fit a signed long', (t) => {
      let sample = agent.queries.samples.values().next().value
      let trace = sample.trace

      t.ok(trace.id <= (2 ** 63 - 1))

      t.end()
    })

    t.test('should capture queries', (t) => {
      t.equal(agent.queries.samples.size, 1)

      let sample = agent.queries.samples.values().next().value
      let trace = sample.trace

      t.equal(sample.total, 1004)
      t.equal(sample.totalExclusive, 1004)
      t.equal(sample.min, 501)
      t.equal(sample.max, 503)
      t.equal(sample.sumOfSquares, 504010)
      t.equal(sample.callCount, 2)
      t.equal(trace.obfuscated, 'select * from foo where b=?')
      t.equal(trace.normalized, 'select*fromfoowhereb=?')
      t.equal(trace.id, 75330402683074160)
      t.equal(trace.query, 'select * from foo where b=1')
      t.equal(trace.metric, 'Datastore/operation/MySql/select')
      t.equal(typeof trace.trace, 'string')

      t.end()
    })

    t.end()
  })

  t.test('without query', (t) => {
    let transaction
    let segment
    let agent

    t.beforeEach((done) => {
      agent = helper.loadMockedAgent({
        slow_sql: {enabled: true},
        transaction_tracer: {
          record_sql: 'obfuscated'
        }
      })

      let ps = new ParsedStatement('MySql', 'select', null, null)

      transaction = new Transaction(agent)
      segment = transaction.trace.add('test')

      segment.setDurationInMillis(503)
      ps.recordMetrics(segment, 'TEST')

      let ps2 = new ParsedStatement('MySql', 'select', null, null)

      let segment2 = transaction.trace.add('test')
      segment2.setDurationInMillis(501)
      ps2.recordMetrics(segment2, 'TEST')

      transaction.end()

      done()
    })

    t.afterEach((done) => {
      helper.unloadAgent(agent)
      done()
    })

    t.test('should update segment names', (t) => {
      t.equal(segment.name, 'Datastore/operation/MySql/select')
      t.end()
    })

    t.test('should not capture queries', (t) => {
      t.match(agent.queries.samples.size, 0)
      t.end()
    })

    t.end()
  })
})
