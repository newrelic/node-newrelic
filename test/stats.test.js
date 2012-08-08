'use strict';

var path          = require('path')
  , chai          = require('chai')
  , should        = chai.should()
  , expect        = chai.expect
  , logger        = require(path.join(__dirname, '..', 'lib', 'logger'))
  , Stats         = require(path.join(__dirname, '..', 'lib', 'stats'))
  , StatsEngine   = require(path.join(__dirname, '..', 'lib', 'stats', 'engine'))
  , Collection    = require(path.join(__dirname, '..', 'lib', 'stats', 'collection'))
  , MetricDataSet = require(path.join(__dirname, '..', 'lib', 'metric', 'data-set'))
  ;

function verifyStats(stats, callCount, totalTime, totalExclusive, min, max) {
  var data = stats.toJSON();
  should.exist(data);

  data[0].should.equal(callCount, "the call counts should match");
  data[1].should.equal(totalTime, "the total time tracked should match");
  data[2].should.equal(totalExclusive, "the total exclusive should match");
  data[3].should.equal(min, "the minimum should match");
  data[4].should.equal(max, "the maximum should match");
}

describe("metric data sets", function () {
  var engine
    , unscoped
    , SCOPE = "TEST"
    , NAME = "Custom/Test/events"
    ;

  beforeEach(function (done) {
    engine   = new StatsEngine();
    unscoped = new Collection(engine);

    return done();
  });

  it("shouldn't complain when given an empty data set", function (done) {
    var mds = new MetricDataSet(unscoped, engine.scopedStats, {});
    var result;
    expect(function () { result = JSON.stringify(mds); }).not.throws();

    result.should.eql('[]');

    return done();
  });

  it("should produce correct data for serialization", function (done) {
    engine.statsByScope(SCOPE).byName(NAME).recordValueInMillis(1200, 1000);

    var mds = new MetricDataSet(unscoped, engine.scopedStats, {});
    var result;
    expect(function () { result = JSON.stringify(mds); }).not.throws();

    var expected = '[[{"name":"Custom/Test/events","scope":"TEST"},[1,1.2,1,1.2,1.2,1.44]]]';
    result.should.equal(expected);

    return done();
  });
});

describe("statistics calculation", function () {
  var statistics;

  beforeEach(function (done) {
    statistics = new Stats();

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
