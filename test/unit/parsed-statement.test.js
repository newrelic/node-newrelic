'use strict'

var chai = require('chai')
var expect = chai.expect
var helper = require('../lib/agent_helper')
var Transaction = require('../../lib/transaction')
var ParsedStatement = require('../../lib/db/parsed-statement')


function checkDatMetric(metrics, name, scope) {
  expect(metrics.getMetric(name, scope).total).to.equal(0.333)
}

describe('recording database metrics', function () {
  var agent
  var metrics


  before(function () {
    agent = helper.loadMockedAgent()
  })

  after(function () {
    helper.unloadAgent(agent)
  })

  describe('on scoped transactions with parsed statements', function () {
    describe('with model', function() {
      before(function () {
        var ps          = new ParsedStatement('NoSQL', 'select', 'test_collection')
          , transaction = new Transaction(agent)
          , segment     = transaction.trace.add('test')


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

      it('should find a scoped metric on the table and operation', function () {
        checkDatMetric(metrics, 'Datastore/statement/NoSQL/test_collection/select', 'TEST')
      })

      it('should find an unscoped metric on the table and operation', function () {
        checkDatMetric(metrics, 'Datastore/statement/NoSQL/test_collection/select')
      })

      it('should find an unscoped rollup metric on the operation', function () {
        checkDatMetric(metrics, 'Datastore/operation/NoSQL/select')
      })

      it('should find a database rollup metric', function () {
        checkDatMetric(metrics, 'Datastore/all')
      })

      it('should find a database rollup metric of type `Other`', function () {
        checkDatMetric(metrics, 'Datastore/allOther')
      })

      it('should find a database type rollup metric of type `All`', function () {
        checkDatMetric(metrics, 'Datastore/NoSQL/all')
      })

      it('should find a database type rollup metric of type `Other`', function () {
        checkDatMetric(metrics, 'Datastore/NoSQL/allOther')
      })
    })

    describe('without model', function() {
      before(function () {
        var ps          = new ParsedStatement('NoSQL', 'select')
          , transaction = new Transaction(agent)
          , segment     = transaction.trace.add('test')


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

      it('should find a scoped metric on the operation', function () {
        checkDatMetric(metrics, 'Datastore/operation/NoSQL/select', 'TEST')
      })

      it('should find an unscoped metric on the operation', function () {
        checkDatMetric(metrics, 'Datastore/operation/NoSQL/select')
      })

      it('should find a database rollup metric', function () {
        checkDatMetric(metrics, 'Datastore/all')
      })

      it('should find a database rollup metric of type `Other`', function () {
        checkDatMetric(metrics, 'Datastore/allOther')
      })

      it('should find a database type rollup metric of type `All`', function () {
        checkDatMetric(metrics, 'Datastore/NoSQL/all')
      })

      it('should find a database type rollup metric of type `Other`', function () {
        checkDatMetric(metrics, 'Datastore/NoSQL/allOther')
      })
    })
  })

  describe('on unscoped transactions with parsed statements', function () {
    describe('with model', function() {
      before(function () {
        var ps          = new ParsedStatement('NoSQL', 'select', 'test_collection')
          , transaction = new Transaction(agent)
          , segment     = transaction.trace.add('test')


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

      it('should find an unscoped metric on the table and operation', function () {
        checkDatMetric(metrics, 'Datastore/statement/NoSQL/test_collection/select')
      })

      it('should find an unscoped rollup metric on the operation', function () {
        checkDatMetric(metrics, 'Datastore/operation/NoSQL/select')
      })

      it('should find an unscoped rollup DB metric', function () {
        checkDatMetric(metrics, 'Datastore/all')
      })

      it('should find an unscoped rollup DB metric of type `Other`', function () {
        checkDatMetric(metrics, 'Datastore/allOther')
      })

      it('should find a database type rollup metric of type `All`', function () {
        checkDatMetric(metrics, 'Datastore/NoSQL/all')
      })

      it('should find a database type rollup metric of type `Other`', function () {
        checkDatMetric(metrics, 'Datastore/NoSQL/allOther')
      })
    })

    describe('without model', function() {
      before(function () {
        var ps          = new ParsedStatement('NoSQL', 'select')
          , transaction = new Transaction(agent)
          , segment     = transaction.trace.add('test')


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

      it('should find an unscoped metric on the operation', function () {
        checkDatMetric(metrics, 'Datastore/operation/NoSQL/select')
      })

      it('should find an unscoped rollup DB metric', function () {
        checkDatMetric(metrics, 'Datastore/all')
      })

      it('should find an unscoped rollup DB metric of type `Other`', function () {
        checkDatMetric(metrics, 'Datastore/allOther')
      })

      it('should find a database type rollup metric of type `All`', function () {
        checkDatMetric(metrics, 'Datastore/NoSQL/all')
      })

      it('should find a database type rollup metric of type `Other`', function () {
        checkDatMetric(metrics, 'Datastore/NoSQL/allOther')
      })
    })
  })
})

describe('recording slow queries', function() {
  describe('with model', function() {
    var transaction
    var segment
    var agent

    before(function () {
      agent = helper.loadMockedAgent(null, {
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

    after(function () {
      helper.unloadAgent(agent)
    })

    it('should update segment names', function() {
      expect(segment.name).equal('Datastore/statement/MySql/foo/select')
    })

    it('should capture queries', function() {
      var keys = Object.keys(agent.queries.samples)
      expect(keys.length).equal(1)

      var sample = agent.queries.samples[keys[0]]
      var trace = sample.trace

      expect(sample.total).equal(1.004)
      expect(sample.totalExclusive).equal(1.004)
      expect(sample.min).equal(0.501)
      expect(sample.max).equal(0.503)
      expect(sample.sumOfSquares).equal(0.50401)
      expect(sample.callCount).equal(2)
      expect(trace.obfuscated).equal('select * from foo where a=?')
      expect(trace.normalized).equal('select*fromfoowherea=?')
      expect(trace.id).equal(35940)
      expect(trace.query).equal('select * from foo where a=1')
      expect(trace.metric).equal('Datastore/statement/MySql/foo/select')
      expect(typeof trace.trace).equal('string')
    })
  })

  describe('without model', function() {
    var transaction
    var segment
    var agent

    before(function () {
      agent = helper.loadMockedAgent(null, {
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

    after(function () {
      helper.unloadAgent(agent)
    })

    it('should update segment names', function() {
      expect(segment.name).equal('Datastore/operation/MySql/select')
    })

    it('should capture queries', function() {
      var keys = Object.keys(agent.queries.samples)
      expect(keys.length).equal(1)

      var sample = agent.queries.samples[keys[0]]
      var trace = sample.trace

      expect(sample.total).equal(1.004)
      expect(sample.totalExclusive).equal(1.004)
      expect(sample.min).equal(0.501)
      expect(sample.max).equal(0.503)
      expect(sample.sumOfSquares).equal(0.50401)
      expect(sample.callCount).equal(2)
      expect(trace.obfuscated).equal('select * from foo where a=?')
      expect(trace.normalized).equal('select*fromfoowherea=?')
      expect(trace.id).equal(35940)
      expect(trace.query).equal('select * from foo where a=1')
      expect(trace.metric).equal('Datastore/operation/MySql/select')
      expect(typeof trace.trace).equal('string')
    })
  })

  describe('without query', function() {
    var transaction
    var segment
    var agent

    before(function () {
      agent = helper.loadMockedAgent(null, {
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

    after(function () {
      helper.unloadAgent(agent)
    })

    it('should update segment names', function() {
      expect(segment.name).equal('Datastore/operation/MySql/select')
    })

    it('should not capture queries', function() {
      var keys = Object.keys(agent.queries.samples)
      console.log(agent.queries.samples)
      expect(keys.length).equal(0)
    })
  })
})
