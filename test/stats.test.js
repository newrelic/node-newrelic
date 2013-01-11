'use strict';

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , Stats  = require(path.join(__dirname, '..', 'lib', 'stats'))
  ;

/*jshint maxparams:8 */
describe("Stats", function () {
  var statistics;

  var verifyStats = function verifyStats(stats, callCount, totalTime,
                                         totalExclusive, min, max, sumOfSquares) {
    expect(stats.callCount).equal(callCount);
    expect(stats.total).equal(totalTime);
    expect(stats.totalExclusive).equal(totalExclusive);
    expect(stats.min).equal(min);
    expect(stats.max).equal(max);
    expect(stats.sumOfSquares).equal(sumOfSquares);
  };

  beforeEach(function () {
    statistics = new Stats();
  });

  it("should correctly summarize a sample set of statistics", function () {
    statistics.recordValueInMillis(51);
    statistics.recordValueInMillis(120, 34);
    statistics.recordValueInMillis(120, 34);

    verifyStats(statistics, 3, 0.291, 0.119, 0.051, 0.120, 0.031401);
  });

  it("should correctly summarize another simple set of statistics", function () {
    statistics.recordValueInMillis(120, 0);
    statistics.recordValueInMillis(120, 0);

    verifyStats(statistics, 2, 0.240, 0.0, 0.120, 0.120, 0.0288);
  });

  describe("when incrementing the call count", function () {
    it("should increment by 1 by default", function () {
      statistics.incrementCallCount();

      verifyStats(statistics, 1, 0, 0, 0, 0, 0);
    });

    it("should increment by the provided value", function () {
      statistics.incrementCallCount(23);

      verifyStats(statistics, 23, 0, 0, 0, 0, 0);
    });

    it("shouldn't increment when the provided value is 0", function () {
      statistics.incrementCallCount(0);

      verifyStats(statistics, 0, 0, 0, 0, 0, 0);
    });
  });

  it("should correctly merge summaries", function () {
    statistics.recordValueInMillis(51);
    statistics.recordValueInMillis(120, 34);
    statistics.recordValueInMillis(120, 34);
    verifyStats(statistics, 3, 0.291, 0.119, 0.051, 0.120, 0.031401);

    var other = new Stats();
    other.recordValueInMillis(120, 0);
    other.recordValueInMillis(120, 0);
    verifyStats(other, 2, 0.240, 0.0, 0.120, 0.120, 0.0288);

    statistics.merge(other);
    // LOL IEEE 754
    verifyStats(statistics, 5, 0.5309999999999999, 0.119, 0.051, 0.120, 0.060201);
  });

  describe("when handling quantities", function () {
    it("should store bytes as bytes, rescaling only at serialization");
    it("should store time as nanoseconds, rescaling only at serialization");
  });
});
