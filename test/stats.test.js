var should  = require('should')
  , stats   = require('../lib/stats')
  ;

function verifyStats(stats, callCount, totalTime, totalExclusive, min, max) {
    var data = stats.toJSON();
    data.should.exist;

    data[0].should.equal(callCount, "the call counts should match");
    data[1].should.equal(totalTime, "the total time tracked should match");
    data[2].should.equal(totalExclusive, "the total exclusive should match");
    data[3].should.equal(min, "the minimum should match");
    data[4].should.equal(max, "the maximum should match");
}

describe('statistics calculation', function () {
  var statistics;

  beforeEach(function (done) {
    statistics = stats.createStats();

    return done();
  });

  it("should properly process a sample set of statistics", function (done) {
    statistics.recordValueInMillis(51);
    statistics.recordValueInMillis(120, 34);
    statistics.recordValueInMillis(120, 34);

    verifyStats(statistics, 3, 0.291, 0.119, 0.051, 0.120);

    return done();
  });

  it("should properly process a simple set of statistics", function (done) {
    statistics.recordValueInMillis(120, 0);
    statistics.recordValueInMillis(120, 0);

    verifyStats(statistics, 2, 0.240, 0.0, 0.120, 0.120);

    return done();
  });
});
