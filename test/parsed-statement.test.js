'use strict';

var path = require('path')
  , chai = require('chai')
  , expect = chai.expect
  , ParsedStatement = require(path.join(__dirname, '..', 'lib', 'db', 'parsed-statement'))
  , Timer = require(path.join(__dirname, '..', 'lib', 'timer'))
  , Transaction = require(path.join(__dirname, '..', 'lib', 'trace', 'transaction'))
  ;

function checkDatMetric(transaction, name, scope) {
  var metric = transaction.getMetrics(name, scope);

  expect(metric).to.exist;
  expect(metric.length).to.equal(1);
  expect(metric[0].getDurationInMillis()).to.equal(333);
}

describe("recording metrics", function () {
  var transaction;

  describe("on scoped transactions involving parsed database statements", function () {
    before(function (done) {
      var ps = new ParsedStatement('select', 'test_collection');

      var timer = new Timer();
      timer.setDurationInMillis(333);

      transaction = new Transaction({name : 'SELECT test'});

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

      transaction = new Transaction({name : 'SELECT test'});

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
