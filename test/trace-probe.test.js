'use strict';

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , Probe  = require(path.join(__dirname, '..', 'lib', 'trace', 'probe'))
  , Trace  = require(path.join(__dirname, '..', 'lib', 'trace-nu'))
  ;

describe("Probe", function () {
  it("should be bound to a Trace", function () {
    expect(function noTrace() {
      var probe = new Probe(null, 'UnitTest');
    }).throws();

    var success = new Probe(new Trace('Test/TraceExample07'), 'UnitTest');
    expect(success.trace).instanceof(Trace);
  });

  it("should be named", function () {
    expect(function noName() {
      var probe = new Probe(new Trace('Test/TraceExample06'));
    }).throws();
    var success = new Probe(new Trace('Test/TraceExample07'), 'UnitTest');
    expect(success.name).equal('UnitTest');
  });

  it("should have 0 children at creation", function () {
    var probe = new Probe(new Trace('Test/TraceExample02'), 'UnitTest');
    expect(probe.children.length).equal(0);
  });

  it("should have a timer", function () {
    var probe = new Probe(new Trace('Test/TraceExample03'), 'UnitTest');
    expect(probe.timer.isRunning()).equal(true);
  });

  it("should accept a callback that records metrics associated with this probe");
  it("should retain any associated SQL statements");
  it("should allow an arbitrary number of Probes from functions called in the scope of this Probe");

  describe("when finished", function () {
    it("should have a finished timer", function () {
      var probe = new Probe(new Trace('Test/TraceExample04'), 'UnitTest');
      probe.finish();
      expect(probe.timer.isRunning()).equal(false);
    });

    it("should know its exclusive duration");
    it("should produce human-readable JSON");
    it("should record its own metrics onto the trace");
  });
});
