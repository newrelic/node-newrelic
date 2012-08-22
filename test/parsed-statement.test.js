'use strict';

var path            = require('path')
  , chai            = require('chai')
  , expect          = chai.expect
  , should          = chai.should()
  , helper          = require(path.join(__dirname, 'lib', 'agent_helper'))
  , Metric          = require(path.join(__dirname, '..', 'lib', 'trace', 'metric'))
  , Timer           = require(path.join(__dirname, '..', 'lib', 'timer'))
  , Transaction     = require(path.join(__dirname, '..', 'lib', 'trace', 'transaction'))
  , ParsedStatement = require(path.join(__dirname, '..', 'lib', 'db', 'parsed-statement'))
  ;

function checkDatMetric(transaction, name, scope) {
  var metric = transaction.getMetrics(name, scope);

  expect(metric).instanceof(Metric);
  expect(metric.stats.total).to.equal(0.333);
}

describe("recording metrics", function () {
  var transaction;

  describe("on scoped transactions involving parsed database statements", function () {
    before(function (done) {
      var ps = new ParsedStatement('select', 'test_collection');

      var timer = new Timer();
      timer.setDurationInMillis(333);

      transaction = new Transaction(helper.loadMockedAgent());

      ps.recordMetrics(transaction, 'TEST', timer);
      transaction.end();

      return done();
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
    before(function (done) {
      var ps = new ParsedStatement('select', 'test_collection');

      var timer = new Timer();
      timer.setDurationInMillis(333);

      transaction = new Transaction(helper.loadMockedAgent());

      ps.recordMetrics(transaction, null, timer);
      transaction.end();

      return done();
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
