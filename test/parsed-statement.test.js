'use strict';

var path            = require('path')
  , chai            = require('chai')
  , expect          = chai.expect
  , should          = chai.should()
  , helper          = require(path.join(__dirname, 'lib', 'agent_helper'))
  , Metric          = require(path.join(__dirname, '..', 'lib', 'metrics', 'metric'))
  , Timer           = require(path.join(__dirname, '..', 'lib', 'timer'))
  , Transaction     = require(path.join(__dirname, '..', 'lib', 'transaction'))
  , ParsedStatement = require(path.join(__dirname, '..', 'lib', 'db', 'parsed-statement'))
  ;

function checkDatMetric(transaction, name, scope) {
  var metric = transaction.getMetrics(name, scope);

  expect(metric).instanceof(Metric);
  expect(metric.stats.total).to.equal(0.333);
}

describe("recording metrics", function () {
  var agent
    , transaction
    ;

  before(function () {
    agent = helper.loadMockedAgent();
  });

  after(function () {
    helper.unloadAgent(agent);
  });

  describe("on scoped transactions involving parsed database statements", function () {
    before(function () {
      var ps = new ParsedStatement('select', 'test_collection');

      transaction = new Transaction(agent);

      var segment = transaction.getTrace().add('test');
      segment.setDurationInMillis(333);
      ps.recordMetrics(segment, 'TEST');
      transaction.end();
    });

    it("should find a scoped database metric bounded to the collection and the operation (SELECT)", function () {
      var metricName = 'Database/test_collection/select';
      checkDatMetric(transaction, metricName, 'TEST');
    });

    it("should find an unscoped database metric bounded to the collection and the operation (SELECT)", function () {
      var metricName = 'Database/test_collection/select';
      checkDatMetric(transaction, metricName);
    });

    it("should find an unscoped database metric bounded to the operation (SELECT)", function () {
      var metricName = 'Database/select';
      checkDatMetric(transaction, metricName);
    });

    it("should find an unbounded, unscoped database metric", function () {
      var metricName = 'Database/all';
      checkDatMetric(transaction, metricName);
    });

    it("should find an unbounded, unscoped database metric of type 'Other' (unless otherwise specified)", function () {
      var metricName = 'Database/all/Other';
      checkDatMetric(transaction, metricName);
    });
  });

  describe("on unscoped transactions involving parsed database statements", function () {
    before(function () {
      var ps = new ParsedStatement('select', 'test_collection');

      transaction = new Transaction(agent);

      var segment = transaction.getTrace().add('test');
      segment.setDurationInMillis(333);
      ps.recordMetrics(segment, null);
      transaction.end();
    });

    it("should find an unscoped database metric bounded to the collection and the operation (SELECT)", function () {
      var metricName = 'Database/test_collection/select';
      checkDatMetric(transaction, metricName);
    });

    it("should find an unscoped database metric bounded to the operation (SELECT)", function () {
      var metricName = 'Database/select';
      checkDatMetric(transaction, metricName);
    });

    it("should find an unbounded, unscoped database metric", function () {
      var metricName = 'Database/all';
      checkDatMetric(transaction, metricName);
    });

    it("should find an unbounded, unscoped database metric of type 'Other' (unless otherwise specified)", function () {
      var metricName = 'Database/all/Other';
      checkDatMetric(transaction, metricName);
    });
  });
});
