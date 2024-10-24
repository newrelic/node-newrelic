/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const helper = require('../lib/agent_helper')
const { match } = require('../lib/custom-assertions')

const Transaction = require('../../lib/transaction')
const ParsedStatement = require('../../lib/db/parsed-statement')
const recordMetrics = require('../../lib/metrics/recorders/database')

function checkMetric(metrics, name, scope) {
  match(metrics.getMetric(name, scope), { total: 0.333 })
}

test('recording database metrics', async (t) => {
  await t.test('on scoped transactions with parsed statements - with collection', async (t) => {
    await t.test('with collection', async (t) => {
      t.beforeEach((ctx) => {
        ctx.nr = {}
        const agent = helper.loadMockedAgent()
        ctx.nr.agent = agent

        const ps = new ParsedStatement('NoSQL', 'select', 'test_collection')
        const transaction = new Transaction(agent)
        const segment = transaction.trace.add('test')

        transaction.type = Transaction.TYPES.BG
        segment.setDurationInMillis(333)
        recordMetrics.bind(ps)(segment, 'TEST')
        transaction.end()

        ctx.nr.metrics = transaction.metrics
      })

      t.afterEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)
      })

      await t.test('should find 1 scoped metric', (t) => {
        const { metrics } = t.nr
        assert.equal(metrics._toScopedData().length, 1)
      })

      await t.test('should find 6 unscoped metrics', (t) => {
        const { metrics } = t.nr
        assert.equal(metrics._toUnscopedData().length, 6)
      })

      await t.test('should find a scoped metric on the table and operation', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/statement/NoSQL/test_collection/select', 'TEST')
      })

      await t.test('should find an unscoped metric on the table and operation', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/statement/NoSQL/test_collection/select')
      })

      await t.test('should find an unscoped rollup metric on the operation', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/operation/NoSQL/select')
      })

      await t.test('should find a database rollup metric', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/all')
      })

      await t.test('should find a database rollup metric of type `Other`', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/allOther')
      })

      await t.test('should find a database type rollup metric of type `All`', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/NoSQL/all')
      })

      await t.test('should find a database type rollup metric of type `Other`', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/NoSQL/allOther')
      })
    })

    await t.test('without collection', async (t) => {
      t.beforeEach((ctx) => {
        ctx.nr = {}
        const agent = helper.loadMockedAgent()
        ctx.nr.agent = agent

        const ps = new ParsedStatement('NoSQL', 'select')
        const transaction = new Transaction(agent)
        const segment = transaction.trace.add('test')

        transaction.type = Transaction.TYPES.BG
        segment.setDurationInMillis(333)
        recordMetrics.bind(ps)(segment, 'TEST')
        transaction.end()

        ctx.nr.metrics = transaction.metrics
      })

      t.afterEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)
      })

      await t.test('should find 1 scoped metric', (t) => {
        const { metrics } = t.nr
        assert.equal(metrics._toScopedData().length, 1)
      })

      await t.test('should find 5 unscoped metrics', (t) => {
        const { metrics } = t.nr
        assert.equal(metrics._toUnscopedData().length, 5)
      })

      await t.test('should find a scoped metric on the operation', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/operation/NoSQL/select', 'TEST')
      })

      await t.test('should find an unscoped metric on the operation', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/operation/NoSQL/select')
      })

      await t.test('should find a database rollup metric', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/all')
      })

      await t.test('should find a database rollup metric of type `Other`', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/allOther')
      })

      await t.test('should find a database type rollup metric of type `All`', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/NoSQL/all')
      })

      await t.test('should find a database type rollup metric of type `Other`', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/NoSQL/allOther')
      })
    })
  })

  await t.test('on unscoped transactions with parsed statements', async (t) => {
    await t.test('with collection', async (t) => {
      t.beforeEach((ctx) => {
        ctx.nr = {}
        const agent = helper.loadMockedAgent()
        ctx.nr.agent = agent

        const ps = new ParsedStatement('NoSQL', 'select', 'test_collection')
        const transaction = new Transaction(agent)
        const segment = transaction.trace.add('test')

        transaction.type = Transaction.TYPES.BG
        segment.setDurationInMillis(333)
        recordMetrics.bind(ps)(segment, null)
        transaction.end()

        ctx.nr.metrics = transaction.metrics
      })

      t.afterEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)
      })

      await t.test('should find 0 unscoped metrics', (t) => {
        const { metrics } = t.nr
        assert.equal(metrics._toScopedData().length, 0)
      })

      await t.test('should find 6 unscoped metrics', (t) => {
        const { metrics } = t.nr
        assert.equal(metrics._toUnscopedData().length, 6)
      })

      await t.test('should find an unscoped metric on the table and operation', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/statement/NoSQL/test_collection/select')
      })

      await t.test('should find an unscoped rollup metric on the operation', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/operation/NoSQL/select')
      })

      await t.test('should find an unscoped rollup DB metric', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/all')
      })

      await test('should find an unscoped rollup DB metric of type `Other`', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/allOther')
      })

      await test('should find a database type rollup metric of type `All`', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/NoSQL/all')
      })

      await test('should find a database type rollup metric of type `Other`', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/NoSQL/allOther')
      })
    })

    await t.test('without collection', async (t) => {
      t.beforeEach((ctx) => {
        ctx.nr = {}
        const agent = helper.loadMockedAgent()
        ctx.nr.agent = agent

        const ps = new ParsedStatement('NoSQL', 'select')
        const transaction = new Transaction(agent)
        const segment = transaction.trace.add('test')

        transaction.type = Transaction.TYPES.BG
        segment.setDurationInMillis(333)
        recordMetrics.bind(ps)(segment, null)
        transaction.end()

        ctx.nr.metrics = transaction.metrics
      })

      t.afterEach((ctx) => {
        helper.unloadAgent(ctx.nr.agent)
      })

      await t.test('should find 0 unscoped metrics', (t) => {
        const { metrics } = t.nr
        assert.equal(metrics._toScopedData().length, 0)
      })

      await t.test('should find 5 unscoped metrics', (t) => {
        const { metrics } = t.nr
        assert.equal(metrics._toUnscopedData().length, 5)
      })

      await t.test('should find an unscoped metric on the operation', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/operation/NoSQL/select')
      })

      await t.test('should find an unscoped rollup DB metric', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/all')
      })

      await t.test('should find an unscoped rollup DB metric of type `Other`', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/allOther')
      })

      await t.test('should find a database type rollup metric of type `All`', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/NoSQL/all')
      })

      await t.test('should find a database type rollup metric of type `Other`', (t) => {
        const { metrics } = t.nr
        checkMetric(metrics, 'Datastore/NoSQL/allOther')
      })
    })
  })
})

test('recording slow queries', async (t) => {
  await t.test('with collection', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      const agent = helper.loadMockedAgent({
        slow_sql: { enabled: true },
        transaction_tracer: {
          record_sql: 'obfuscated'
        }
      })
      ctx.nr.agent = agent

      const ps = new ParsedStatement('MySql', 'select', 'foo', 'select * from foo where b=1')

      const transaction = new Transaction(agent)
      ctx.nr.transaction = transaction
      transaction.type = Transaction.TYPES.BG
      const segment = transaction.trace.add('test')
      ctx.nr.segment = segment

      segment.setDurationInMillis(503)
      recordMetrics.bind(ps)(segment, 'TEST')

      const ps2 = new ParsedStatement('MySql', 'select', 'foo', 'select * from foo where b=2')

      const segment2 = transaction.trace.add('test')
      segment2.setDurationInMillis(501)
      recordMetrics.bind(ps2)(segment2, 'TEST')

      transaction.end()
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('should update segment names', (t) => {
      const { segment } = t.nr
      assert.equal(segment.name, 'Datastore/statement/MySql/foo/select')
    })

    await t.test('should capture queries', (t) => {
      const { agent } = t.nr
      assert.equal(agent.queries.samples.size, 1)

      const sample = agent.queries.samples.values().next().value
      const trace = sample.trace

      assert.equal(sample.total, 1004)
      assert.equal(sample.totalExclusive, 1004)
      assert.equal(sample.min, 501)
      assert.equal(sample.max, 503)
      assert.equal(sample.sumOfSquares, 504010)
      assert.equal(sample.callCount, 2)
      assert.equal(trace.obfuscated, 'select * from foo where b=?')
      assert.equal(trace.normalized, 'select*fromfoowhereb=?')
      assert.equal(trace.id, 75330402683074160)
      assert.equal(trace.query, 'select * from foo where b=1')
      assert.equal(trace.metric, 'Datastore/statement/MySql/foo/select')
      assert.equal(typeof trace.trace, 'string')
    })
  })

  await t.test('without collection', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      const agent = helper.loadMockedAgent({
        slow_sql: { enabled: true },
        transaction_tracer: {
          record_sql: 'obfuscated'
        }
      })
      ctx.nr.agent = agent

      const ps = new ParsedStatement('MySql', 'select', null, 'select * from foo where b=1')

      const transaction = new Transaction(agent)
      const segment = transaction.trace.add('test')
      ctx.nr.transaction = transaction
      ctx.nr.segment = segment

      segment.setDurationInMillis(503)
      recordMetrics.bind(ps)(segment, 'TEST')

      const ps2 = new ParsedStatement('MySql', 'select', null, 'select * from foo where b=2')

      const segment2 = transaction.trace.add('test')
      segment2.setDurationInMillis(501)
      recordMetrics.bind(ps2)(segment2, 'TEST')

      transaction.end()
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('should update segment names', (t) => {
      const { segment } = t.nr
      assert.equal(segment.name, 'Datastore/operation/MySql/select')
    })

    await t.test('should have IDs that fit a signed long', (t) => {
      const { agent } = t.nr
      const sample = agent.queries.samples.values().next().value
      const trace = sample.trace

      assert.ok(trace.id <= 2 ** 63 - 1)
    })

    await t.test('should capture queries', (t) => {
      const { agent } = t.nr
      assert.equal(agent.queries.samples.size, 1)

      const sample = agent.queries.samples.values().next().value
      const trace = sample.trace

      assert.equal(sample.total, 1004)
      assert.equal(sample.totalExclusive, 1004)
      assert.equal(sample.min, 501)
      assert.equal(sample.max, 503)
      assert.equal(sample.sumOfSquares, 504010)
      assert.equal(sample.callCount, 2)
      assert.equal(trace.obfuscated, 'select * from foo where b=?')
      assert.equal(trace.normalized, 'select*fromfoowhereb=?')
      assert.equal(trace.id, 75330402683074160)
      assert.equal(trace.query, 'select * from foo where b=1')
      assert.equal(trace.metric, 'Datastore/operation/MySql/select')
      assert.equal(typeof trace.trace, 'string')
    })
  })

  await t.test('without query', async (t) => {
    t.beforeEach((ctx) => {
      ctx.nr = {}
      const agent = helper.loadMockedAgent({
        slow_sql: { enabled: true },
        transaction_tracer: {
          record_sql: 'obfuscated'
        }
      })
      ctx.nr.agent = agent

      const ps = new ParsedStatement('MySql', 'select', null, null)

      const transaction = new Transaction(agent)
      const segment = transaction.trace.add('test')
      ctx.nr.transaction = transaction
      ctx.nr.segment = segment

      segment.setDurationInMillis(503)
      recordMetrics.bind(ps)(segment, 'TEST')

      const ps2 = new ParsedStatement('MySql', 'select', null, null)

      const segment2 = transaction.trace.add('test')
      segment2.setDurationInMillis(501)
      recordMetrics.bind(ps2)(segment2, 'TEST')

      transaction.end()
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('should update segment names', (t) => {
      const { segment } = t.nr
      assert.equal(segment.name, 'Datastore/operation/MySql/select')
    })

    await t.test('should not capture queries', (t) => {
      const { agent } = t.nr
      assert.equal(agent.queries.samples.size, 0)
    })
  })
})
