'use strict';

var path         = require('path')
  , chai         = require('chai')
  , expect       = chai.expect
  , TraceSegment = require(path.join(__dirname, '..', 'lib', 'transaction', 'trace', 'segment'))
  , Trace        = require(path.join(__dirname, '..', 'lib', 'transaction', 'trace'))
  , Transaction  = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

describe("TraceSegment", function () {
  it("should be bound to a Trace", function () {
    expect(function noTrace() {
      var segment = new TraceSegment(null, 'UnitTest');
    }).throws();

    var success = new TraceSegment(new Trace('Test/TraceExample07'), 'UnitTest');
    expect(success.trace).instanceof(Trace);
  });

  it("should call an optional callback function", function (done) {
    expect(function noCallback() {
      var segment = new TraceSegment(new Trace('Test/TraceExample08'), 'UnitTest');
    }).not.throws();

    var working = new TraceSegment(new Trace(new Transaction('Test/TraceExample09')), 'UnitTest', function () {
      return done();
    });
    working.end();
  });

  it("should be named", function () {
    expect(function noName() {
      var segment = new TraceSegment(new Trace('Test/TraceExample06'));
    }).throws();
    var success = new TraceSegment(new Trace('Test/TraceExample07'), 'UnitTest');
    expect(success.name).equal('UnitTest');
  });

  it("should have 0 children at creation", function () {
    var segment = new TraceSegment(new Trace('Test/TraceExample02'), 'UnitTest');
    expect(segment.children.length).equal(0);
  });

  it("should have a timer", function () {
    var segment = new TraceSegment(new Trace('Test/TraceExample03'), 'UnitTest');
    expect(segment.timer.isRunning()).equal(true);
  });

  it("should accept a callback that records metrics associated with this segment", function (done) {
    var segment = new TraceSegment(new Trace(new Transaction('Test/TraceExample10')), 'UnitTest', function (insider) {
      expect(insider).equal(segment);
      return done();
    });

    segment.end();
  });

  it("should retain any associated SQL statements");
  it("should allow an arbitrary number of TraceSegments from functions called in the scope of this TraceSegment");

  describe("when ended", function () {
    it("should have a ended timer", function () {
      var segment = new TraceSegment(new Trace('Test/TraceExample04'), 'UnitTest');
      segment.end();
      expect(segment.timer.isRunning()).equal(false);
    });

    it("should know its exclusive duration");
    it("should produce human-readable JSON");

    it("should produce JSON that conforms to the collector spec", function () {
      var trace = new Trace('WebTransaction/Uri/test');
      var segment = new TraceSegment(trace, 'DB/select/getSome');
      segment.setDurationInMillis(14, 3);
      // See documentation on TraceSegment.toJSON for what goes in which field.
      expect(segment.toJSON()).deep.equal([3, 17, 'DB/select/getSome', null, []]);
    });

    it("should record its own metrics onto the trace");
  });
});
