'use strict';

var path        = require('path')
  , chai        = require('chai')
  , expect      = chai.expect
  , helper      = require(path.join(__dirname, 'lib', 'agent_helper'))
  , Probe       = require(path.join(__dirname, '..', 'lib', 'transaction', 'probe'))
  , Trace       = require(path.join(__dirname, '..', 'lib', 'trace'))
  , Transaction = require(path.join(__dirname, '..', 'lib', 'trace', 'transaction'))
  ;

describe('Trace', function () {
  it("should always be bound to a transaction", function () {
    // fail
    expect(function () {
      var transam = new Trace();
    }).throws(/must be associated with a transaction/);

    // succeed
    var tt = new Trace(new Transaction(helper.loadMockedAgent()));
    expect(tt.transaction).instanceof(Transaction);
  });

  it("should have the root of a Probe tree", function () {
    var tt = new Trace(new Transaction(helper.loadMockedAgent()));
    expect(tt.root).instanceof(Probe);
  });

  it("should be the primary interface for adding probes to a trace", function () {
    var trace = new Trace(new Transaction(helper.loadMockedAgent()));
    expect(function () { trace.add('Custom/Test17/Child1'); }).not.throws();
  });

  it("should produce a transaction trace in the collector's expected format");
  it("should produce human-readable JSON of the entire trace graph");

  describe("when inserting probes", function () {
    var trace;

    beforeEach(function () {
      trace = new Trace(new Transaction(helper.loadMockedAgent()));
    });

    it("should require a name for the new probe", function () {
      expect(function () { trace.add(); }).throws(/must be named/);
    });

    it("should allow child probes on a trace", function () {
      expect(function () { trace.add('Custom/Test17/Child1'); }).not.throws();
    });

    it("should return the probe", function () {
      var probe;
      expect(function () { probe = trace.add('Custom/Test18/Child1'); }).not.throws();
      expect(probe).instanceof(Probe);
    });

    it("should measure exclusive time vs total time at each level of the graph", function () {
      var child = trace.add('Custom/Test18/Child1');

      trace.setDurationInMillis(42);
      child.setDurationInMillis(22, 0);

      expect(trace.getExclusiveDurationInMillis()).equal(20);
    });

    it("should accurately sum overlapping probes", function () {
      trace.setDurationInMillis(42);

      var now = Date.now();

      var child1 = trace.add('Custom/Test19/Child1');
      child1.setDurationInMillis(22, now);

      // add another child trace completely encompassed by the first
      var child2 = trace.add('Custom/Test19/Child2');
      child2.setDurationInMillis(5, now + 5);

      // add another that starts within the first range but that extends beyond
      var child3 = trace.add('Custom/Test19/Child3');
      child3.setDurationInMillis(22, now + 11);

      // add a final child that's entirely disjoint
      var child4 = trace.add('Custom/Test19/Child4');
      child4.setDurationInMillis(4, now + 35);

      expect(trace.getExclusiveDurationInMillis()).equal(5);
    });

    it("should accurately sum partially overlapping probes", function () {
      trace.setDurationInMillis(42);

      var now = Date.now();

      var child1 = trace.add('Custom/Test20/Child1');
      child1.setDurationInMillis(22, now);

      // add another child trace completely encompassed by the first
      var child2 = trace.add('Custom/Test20/Child2');
      child2.setDurationInMillis(5, now + 5);

      // add another that starts simultaneously with the first range but that extends beyond
      var child3 = trace.add('Custom/Test20/Child3');
      child3.setDurationInMillis(33, now);

      expect(trace.getExclusiveDurationInMillis()).equal(9);
    });

    it("should accurately sum partially overlapping, open-ranged probes", function () {
      trace.setDurationInMillis(42);

      var now = Date.now();

      var child1 = trace.add('Custom/Test21/Child1');
      child1.setDurationInMillis(22, now);

      // add a range that starts at the exact end of the first
      var child2 = trace.add('Custom/Test21/Child2');
      child2.setDurationInMillis(11, now + 22);

      // FIXME: validate that the above works?
      expect(trace.getExclusiveDurationInMillis()).equal(9);
    });
  });
});
