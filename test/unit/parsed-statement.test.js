/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var chai = require('chai')
var expect = chai.expect
var helper = require('../lib/agent_helper')
var Transaction = require('../../lib/transaction')
var ParsedStatement = require('../../lib/db/parsed-statement')


function checkMetric(metrics, name, scope) {
  expect(metrics.getMetric(name, scope)).to.have.property('total', 0.333)
}

describe('recording database metrics', function() {
  var agent
  var metrics


  before(function() {
    agent = helper.loadMockedAgent()
  })

  after(function() {
    helper.unloadAgent(agent)
  })

  describe('on scoped transactions with parsed statements', function() {
    describe('with collection', function() {
      before(function() {
        var ps          = new ParsedStatement('NoSQL', 'select', 'test_collection')
        var transaction = new Transaction(agent)
        var segment     = transaction.trace.add('test')

        transaction.type = Transaction.TYPES.BG
        segment.setDurationInMillis(333)
        ps.recordMetrics(segment, 'TEST')
        transaction.end()

        metrics = transaction.metrics
      })

      it('should find 1 scoped metric', function() {
        expect(metrics._toScopedData().length).to.equal(1)
      })

      it('should find 6 unscoped metrics', function() {
        expect(metrics._toUnscopedData().length).to.equal(6)
      })

      it('should find a scoped metric on the table and operation', function() {
        checkMetric(metrics, 'Datastore/statement/NoSQL/test_collection/select', 'TEST')
      })

      it('should find an unscoped metric on the table and operation', function() {
        checkMetric(metrics, 'Datastore/statement/NoSQL/test_collection/select')
      })

      it('should find an unscoped rollup metric on the operation', function() {
        checkMetric(metrics, 'Datastore/operation/NoSQL/select')
      })

      it('should find a database rollup metric', function() {
        checkMetric(metrics, 'Datastore/all')
      })

      it('should find a database rollup metric of type `Other`', function() {
        checkMetric(metrics, 'Datastore/allOther')
      })

      it('should find a database type rollup metric of type `All`', function() {
        checkMetric(metrics, 'Datastore/NoSQL/all')
      })

      it('should find a database type rollup metric of type `Other`', function() {
        checkMetric(metrics, 'Datastore/NoSQL/allOther')
      })
    })

    describe('without collection', function() {
      before(function() {
        var ps          = new ParsedStatement('NoSQL', 'select')
        var transaction = new Transaction(agent)
        var segment     = transaction.trace.add('test')

        transaction.type = Transaction.TYPES.BG
        segment.setDurationInMillis(333)
        ps.recordMetrics(segment, 'TEST')
        transaction.end()

        metrics = transaction.metrics
      })

      it('should find 1 scoped metric', function() {
        expect(metrics._toScopedData().length).to.equal(1)
      })

      it('should find 5 unscoped metrics', function() {
        expect(metrics._toUnscopedData().length).to.equal(5)
      })

      it('should find a scoped metric on the operation', function() {
        checkMetric(metrics, 'Datastore/operation/NoSQL/select', 'TEST')
      })

      it('should find an unscoped metric on the operation', function() {
        checkMetric(metrics, 'Datastore/operation/NoSQL/select')
      })

      it('should find a database rollup metric', function() {
        checkMetric(metrics, 'Datastore/all')
      })

      it('should find a database rollup metric of type `Other`', function() {
        checkMetric(metrics, 'Datastore/allOther')
      })

      it('should find a database type rollup metric of type `All`', function() {
        checkMetric(metrics, 'Datastore/NoSQL/all')
      })

      it('should find a database type rollup metric of type `Other`', function() {
        checkMetric(metrics, 'Datastore/NoSQL/allOther')
      })
    })
  })

  describe('on unscoped transactions with parsed statements', function() {
    describe('with collection', function() {
      before(function() {
        var ps          = new ParsedStatement('NoSQL', 'select', 'test_collection')
        var transaction = new Transaction(agent)
        var segment     = transaction.trace.add('test')

        transaction.type = Transaction.TYPES.BG
        segment.setDurationInMillis(333)
        ps.recordMetrics(segment, null)
        transaction.end()

        metrics = transaction.metrics
      })

      it('should find 0 unscoped metrics', function() {
        expect(metrics._toScopedData().length).to.equal(0)
      })

      it('should find 6 unscoped metrics', function() {
        expect(metrics._toUnscopedData().length).to.equal(6)
      })

      it('should find an unscoped metric on the table and operation', function() {
        checkMetric(metrics, 'Datastore/statement/NoSQL/test_collection/select')
      })

      it('should find an unscoped rollup metric on the operation', function() {
        checkMetric(metrics, 'Datastore/operation/NoSQL/select')
      })

      it('should find an unscoped rollup DB metric', function() {
        checkMetric(metrics, 'Datastore/all')
      })

      it('should find an unscoped rollup DB metric of type `Other`', function() {
        checkMetric(metrics, 'Datastore/allOther')
      })

      it('should find a database type rollup metric of type `All`', function() {
        checkMetric(metrics, 'Datastore/NoSQL/all')
      })

      it('should find a database type rollup metric of type `Other`', function() {
        checkMetric(metrics, 'Datastore/NoSQL/allOther')
      })
    })

    describe('without collection', function() {
      before(function() {
        var ps          = new ParsedStatement('NoSQL', 'select')
        var transaction = new Transaction(agent)
        var segment     = transaction.trace.add('test')

        transaction.type = Transaction.TYPES.BG
        segment.setDurationInMillis(333)
        ps.recordMetrics(segment, null)
        transaction.end()

        metrics = transaction.metrics
      })

      it('should find 0 unscoped metrics', function() {
        expect(metrics._toScopedData().length).to.equal(0)
      })

      it('should find 5 unscoped metrics', function() {
        expect(metrics._toUnscopedData().length).to.equal(5)
      })

      it('should find an unscoped metric on the operation', function() {
        checkMetric(metrics, 'Datastore/operation/NoSQL/select')
      })

      it('should find an unscoped rollup DB metric', function() {
        checkMetric(metrics, 'Datastore/all')
      })

      it('should find an unscoped rollup DB metric of type `Other`', function() {
        checkMetric(metrics, 'Datastore/allOther')
      })

      it('should find a database type rollup metric of type `All`', function() {
        checkMetric(metrics, 'Datastore/NoSQL/all')
      })

      it('should find a database type rollup metric of type `Other`', function() {
        checkMetric(metrics, 'Datastore/NoSQL/allOther')
      })
    })
  })
})

describe('recording slow queries', function() {
  describe('with collection', function() {
    var transaction
    var segment
    var agent

    before(function() {
      agent = helper.loadMockedAgent({
        slow_sql: {enabled: true},
        transaction_tracer: {
          record_sql: 'obfuscated'
        }
      })

      var ps = new ParsedStatement(
        'MySql',
        'select',
        'foo',
        'select * from foo where a=1'
      )

      transaction = new Transaction(agent)
      transaction.type = Transaction.TYPES.BG
      segment = transaction.trace.add('test')

      segment.setDurationInMillis(503)
      ps.recordMetrics(segment, 'TEST')

      var ps2 = new ParsedStatement(
        'MySql',
        'select',
        'foo',
        'select * from foo where a=2'
      )

      var segment2 = transaction.trace.add('test')
      segment2.setDurationInMillis(501)
      ps2.recordMetrics(segment2, 'TEST')

      transaction.end()
    })

    after(function() {
      helper.unloadAgent(agent)
    })

    it('should update segment names', function() {
      expect(segment.name).equal('Datastore/statement/MySql/foo/select')
    })

    it('should capture queries', function() {
      expect(agent.queries.samples).to.have.property('size', 1)

      var sample = agent.queries.samples.values().next().value
      var trace = sample.trace

      expect(sample.total).equal(1004)
      expect(sample.totalExclusive).equal(1004)
      expect(sample.min).equal(501)
      expect(sample.max).equal(503)
      expect(sample.sumOfSquares).equal(504010)
      expect(sample.callCount).equal(2)
      expect(trace.obfuscated).equal('select * from foo where a=?')
      expect(trace.normalized).equal('select*fromfoowherea=?')
      expect(trace.id).equal(2680623426242782700)
      expect(trace.query).equal('select * from foo where a=1')
      expect(trace.metric).equal('Datastore/statement/MySql/foo/select')
      expect(typeof trace.trace).equal('string')
    })
  })

  describe('without collection', function() {
    var transaction
    var segment
    var agent

    before(function() {
      agent = helper.loadMockedAgent({
        slow_sql: {enabled: true},
        transaction_tracer: {
          record_sql: 'obfuscated'
        }
      })

      var ps = new ParsedStatement(
        'MySql',
        'select',
        null,
        'select * from foo where a=1'
      )

      transaction = new Transaction(agent)
      segment = transaction.trace.add('test')

      segment.setDurationInMillis(503)
      ps.recordMetrics(segment, 'TEST')

      var ps2 = new ParsedStatement(
        'MySql',
        'select',
        null,
        'select * from foo where a=2'
      )

      var segment2 = transaction.trace.add('test')
      segment2.setDurationInMillis(501)
      ps2.recordMetrics(segment2, 'TEST')

      transaction.end()
    })

    after(function() {
      helper.unloadAgent(agent)
    })

    it('should update segment names', function() {
      expect(segment.name).equal('Datastore/operation/MySql/select')
    })

    it('should capture queries', function() {
      expect(agent.queries.samples).to.have.property('size', 1)

      var sample = agent.queries.samples.values().next().value
      var trace = sample.trace

      expect(sample.total).equal(1004)
      expect(sample.totalExclusive).equal(1004)
      expect(sample.min).equal(501)
      expect(sample.max).equal(503)
      expect(sample.sumOfSquares).equal(504010)
      expect(sample.callCount).equal(2)
      expect(trace.obfuscated).equal('select * from foo where a=?')
      expect(trace.normalized).equal('select*fromfoowherea=?')
      expect(trace.id).equal(2680623426242782700)
      expect(trace.query).equal('select * from foo where a=1')
      expect(trace.metric).equal('Datastore/operation/MySql/select')
      expect(typeof trace.trace).equal('string')
    })
  })

  describe('without query', function() {
    var transaction
    var segment
    var agent

    before(function() {
      agent = helper.loadMockedAgent({
        slow_sql: {enabled: true},
        transaction_tracer: {
          record_sql: 'obfuscated'
        }
      })

      var ps = new ParsedStatement('MySql', 'select', null, null)

      transaction = new Transaction(agent)
      segment = transaction.trace.add('test')

      segment.setDurationInMillis(503)
      ps.recordMetrics(segment, 'TEST')

      var ps2 = new ParsedStatement('MySql', 'select', null, null)

      var segment2 = transaction.trace.add('test')
      segment2.setDurationInMillis(501)
      ps2.recordMetrics(segment2, 'TEST')

      transaction.end()
    })

    after(function() {
      helper.unloadAgent(agent)
    })

    it('should update segment names', function() {
      expect(segment.name).equal('Datastore/operation/MySql/select')
    })

    it('should not capture queries', function() {
      expect(agent.queries.samples).to.have.property('size', 0)
    })
  })
})
