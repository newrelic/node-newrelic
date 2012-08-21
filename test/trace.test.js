'use strict';

var path   = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , Agent = require(path.join(__dirname, '..', 'lib', 'agent'))
  , Trace  = require(path.join(__dirname, '..', 'lib', 'trace-nu'))
  , Transaction = require(path.join(__dirname, '..', 'lib', 'trace', 'transaction'))
  ;

describe('Trace', function () {
  it("should always be bound to a transaction");
  it("should have the root of a Probe tree");
  it("should be the primary interface for adding probes to a trace");
  it("should produce a transaction trace in the collector's protocol");
  it("should produce human-readable JSON of the entire trace graph");

  describe("when creating child probes", function () {
    var tt;

    beforeEach(function () {
      tt = new Transaction(new Agent());
    });

    it("should allow child traces on an existing trace", function () {
      var trace = tt.measure('Custom/Test17');

      expect(function () { trace.addChild('Custom/Test17/Child1'); }).not.throws();
    });

    it("should measure exclusive time vs total time at each level of the graph", function () {
      var trace = tt.measure('Custom/Test18')
        , child = trace.addChild('Custom/Test18/Child1');

      trace.setDurationInMillis(42);
      child.setDurationInMillis(22);

      var metrics = tt.getMetrics('Custom/Test18');
      expect(metrics.length).to.equal(1);
      metrics[0].getDurationInMillis().should.equal(42);
      metrics[0].getExclusiveDurationInMillis().should.equal(20);
    });

    it("should accurately sum overlapping child traces", function () {
      var trace = tt.measure('Custom/Test19');

      trace.setDurationInMillis(42);

      var now = Date.now();

      var child1 = trace.addChild('Custom/Test19/Child1');
      child1.setDurationInMillis(22, now);

      // add another child trace completely encompassed by the first
      var child2 = trace.addChild('Custom/Test19/Child2');
      child2.setDurationInMillis(5, now + 5);

      // add another that starts within the first range but that extends beyond
      var child3 = trace.addChild('Custom/Test19/Child3');
      child3.setDurationInMillis(22, now + 11);

      // add a final child that's entirely disjoint
      var child4 = trace.addChild('Custom/Test19/Child4');
      child4.setDurationInMillis(4, now + 35);

      var metrics = tt.getMetrics('Custom/Test19');
      expect(metrics.length).to.equal(1);
      metrics[0].getDurationInMillis().should.equal(42);
      metrics[0].getExclusiveDurationInMillis().should.equal(5);
    });

    it("should accurately sum partially overlapping child traces", function () {
      var trace = tt.measure('Custom/Test20');

      trace.setDurationInMillis(42);

      var now = Date.now();

      var child1 = trace.addChild('Custom/Test20/Child1');
      child1.setDurationInMillis(22, now);

      // add another child trace completely encompassed by the first
      var child2 = trace.addChild('Custom/Test20/Child2');
      child2.setDurationInMillis(5, now + 5);

      // add another that starts simultaneously with the first range but that extends beyond
      var child3 = trace.addChild('Custom/Test20/Child3');
      child3.setDurationInMillis(33, now);

      var metrics = tt.getMetrics('Custom/Test20');
      expect(metrics.length).to.equal(1);
      metrics[0].getDurationInMillis().should.equal(42);
      metrics[0].getExclusiveDurationInMillis().should.equal(9);
    });

    it("should accurately sum partially overlapping, open-ranged child traces", function () {
      var trace = tt.measure('Custom/Test21');

      trace.setDurationInMillis(42);

      var now = Date.now();

      var child1 = trace.addChild('Custom/Test21/Child1');
      child1.setDurationInMillis(22, now);

      // add a range that starts at the exact end of the first
      var child2 = trace.addChild('Custom/Test21/Child2');
      child2.setDurationInMillis(11, now + 22);

      var metrics = tt.getMetrics('Custom/Test21');
      expect(metrics.length).to.equal(1);
      metrics[0].getDurationInMillis().should.equal(42);
      metrics[0].getExclusiveDurationInMillis().should.equal(9);
    });
  });
});
