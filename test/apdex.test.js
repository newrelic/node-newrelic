'use strict';

var path       = require('path')
  , chai       = require('chai')
  , expect     = chai.expect
  , ApdexStats = require(path.join(__dirname, '..', 'lib', 'stats', 'apdex'))
  ;

describe("ApdexStats", function () {
  var statistics;

  var verifyApdexStats = function verifyApdexStats(stats, satisfying, tolerating, frustrating) {
    expect(stats.satisfying).equal(satisfying);
    expect(stats.tolerating).equal(tolerating);
    expect(stats.frustrating).equal(frustrating);
  };

  beforeEach(function () {
    statistics = new ApdexStats(0.3);
  });

  it("should throw when created with no tolerating value", function () {
    expect(function () { var apdex = new ApdexStats(); })
      .throws('Apdex summary must be created with a tolerated value');
  });

  it("should export apdexT in the 4th field of the timeslice", function () {
    expect(statistics.toJSON()[3]).equal(0.3);
  });

  it("should export apdexT in the 5th field (why?) of the timeslice", function () {
    expect(statistics.toJSON()[4]).equal(0.3);
  });

  it("should correctly summarize a sample set of statistics", function () {
    statistics.recordValueInMillis(1251);
    statistics.recordValueInMillis(250);
    statistics.recordValueInMillis(487);

    verifyApdexStats(statistics, 1, 1, 1);
  });

  it("should correctly summarize another simple set of statistics", function () {
    statistics.recordValueInMillis(120);
    statistics.recordValueInMillis(120);
    statistics.recordValueInMillis(120);
    statistics.recordValueInMillis(120);

    verifyApdexStats(statistics, 4, 0, 0);
  });

  it("should correctly merge summaries", function () {
    statistics.recordValueInMillis(1251);
    statistics.recordValueInMillis(250);
    statistics.recordValueInMillis(487);

    verifyApdexStats(statistics, 1, 1, 1);

    var other = new ApdexStats(0.3);
    other.recordValueInMillis(120);
    other.recordValueInMillis(120);
    other.recordValueInMillis(120);
    other.recordValueInMillis(120);
    verifyApdexStats(other, 4, 0, 0);

    statistics.merge(other);
    verifyApdexStats(statistics, 5, 1, 1);
  });
});
