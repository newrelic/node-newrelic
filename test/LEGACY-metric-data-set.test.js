'use strict';

var path          = require('path')
  , chai          = require('chai')
  , should        = chai.should()
  , expect        = chai.expect
  , StatsEngine   = require(path.join(__dirname, '..', 'lib', 'stats', 'engine'))
  , Collection    = require(path.join(__dirname, '..', 'lib', 'stats', 'collection'))
  , MetricDataSet = require(path.join(__dirname, '..', 'lib', 'metric', 'data-set'))
  ;

describe("metric data sets", function () {
  var engine
    , unscoped
    , SCOPE = "TEST"
    , NAME = "Custom/Test/events"
    ;

  beforeEach(function () {
    engine   = new StatsEngine();
    unscoped = new Collection(engine);
  });

  it("shouldn't complain when given an empty data set", function () {
    var mds = new MetricDataSet(unscoped, engine.scopedStats, {});
    var result;
    expect(function () { result = JSON.stringify(mds); }).not.throws();

    result.should.eql('[]');
  });

  it("should produce correct data for serialization", function () {
    engine.statsByScope(SCOPE).byName(NAME).recordValueInMillis(1200, 1000);

    var mds = new MetricDataSet(unscoped, engine.scopedStats, {});
    var result;
    expect(function () { result = JSON.stringify(mds); }).not.throws();

    result.should.equal('[[{"name":"Custom/Test/events","scope":"TEST"},[1,1.2,1,1.2,1.2,1.44]]]');
  });
});
