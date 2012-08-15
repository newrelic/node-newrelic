'use strict';

var path          = require('path')
  , chai          = require('chai')
  , should        = chai.should()
  , expect        = chai.expect
  , StatsEngine   = require(path.join(__dirname, '..', 'lib', 'stats', 'engine'))
  ;

describe("StatsEngine", function () {
  var engine
    , SCOPE = "TEST"
    , NAME = "Custom/Test/events"
    ;

  beforeEach(function () {
    engine   = new StatsEngine();
  });

  it("shouldn't complain when given an empty data set", function () {
    var mds = engine.getMetricData();
    var result;
    expect(function () { result = JSON.stringify(mds); }).not.throws();

    result.should.eql('[]');
  });

  it("should produce correct data for serialization", function () {
    engine.statsByScope(SCOPE).byName(NAME).recordValueInMillis(1200, 1000);

    var mds = engine.getMetricData();
    var result;
    expect(function () { result = JSON.stringify(mds); }).not.throws();

    result.should.equal('[[{"name":"Custom/Test/events","scope":"TEST"},[1,1.2,1,1.2,1.2,1.44]]]');
  });
});
