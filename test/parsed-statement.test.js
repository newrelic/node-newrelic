'use strict';

var path            = require('path')
  , chai            = require('chai')
  , expect          = chai.expect
  , helper          = require(path.join(__dirname, 'lib', 'agent_helper'))
  , Transaction     = require(path.join(__dirname, '..', 'lib', 'transaction'))
  , ParsedStatement = require(path.join(__dirname, '..', 'lib', 'db', 'parsed-statement'))
  ;

function checkDatMetric(metrics, name, scope) {
  expect(metrics.getMetric(name, scope).total).to.equal(0.333);
}

describe("recording database metrics", function () {
  var agent
    , metrics
    ;

  before(function () {
    agent = helper.loadMockedAgent();
  });

  after(function () {
    helper.unloadAgent(agent);
  });

  describe("on scoped transactions with parsed statements", function () {
    before(function () {
      var ps          = new ParsedStatement('NoSQL', 'select', 'test_collection')
        , transaction = new Transaction(agent)
        , segment     = transaction.getTrace().add('test')
        ;

      segment.setDurationInMillis(333);
      ps.recordMetrics(segment, 'TEST');
      transaction.end();

      metrics = transaction.metrics;
    });

    it("should find a scoped metric on the table and operation", function () {
      checkDatMetric(metrics, 'Datastore/statement/NoSQL/test_collection/select', 'TEST');
    });

    it("should find an unscoped metric on the table and operation", function () {
      checkDatMetric(metrics, 'Datastore/statement/NoSQL/test_collection/select');
    });

    it("should find an unscoped rollup metric on the operation", function () {
      checkDatMetric(metrics, 'Datastore/operation/NoSQL/select');
    });

    it("should find a database rollup metric", function () {
      checkDatMetric(metrics, 'Datastore/all');
    });

    it("should find a database rollup metric of type 'Other'", function () {
      checkDatMetric(metrics, 'Datastore/allOther');
    });
  });

  describe("on unscoped transactions with parsed statements", function () {
    before(function () {
      var ps          = new ParsedStatement('NoSQL', 'select', 'test_collection')
        , transaction = new Transaction(agent)
        , segment     = transaction.getTrace().add('test')
        ;

      segment.setDurationInMillis(333);
      ps.recordMetrics(segment, null);
      transaction.end();

      metrics = transaction.metrics;
    });

    it("should find an unscoped metric on the table and operation", function () {
      checkDatMetric(metrics, 'Datastore/statement/NoSQL/test_collection/select');
    });

    it("should find an unscoped rollup metric on the operation", function () {
      checkDatMetric(metrics, 'Datastore/operation/NoSQL/select');
    });

    it("should find an unscoped rollup DB metric", function () {
      checkDatMetric(metrics, 'Datastore/all');
    });

    it("should find an unscoped rollup DB metric of type 'Other'", function () {
      checkDatMetric(metrics, 'Datastore/allOther');
    });
  });
});
