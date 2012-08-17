'use strict';

var path        = require('path')
  , chai        = require('chai')
  , should      = chai.should()
  , expect      = chai.expect
  , transaction = require(path.join(__dirname, '..', 'lib', 'transaction', 'manager'))
  ;

describe("Transaction", function () {
  // don't add Sinon into the mix until I know what to spy on
  var agent = {name : "test application"};

  describe("when dealing with individual traces", function () {
    it("should add traces by name", function () {
      var tt = transaction.create(agent);

      tt.measure('Custom/Test01');
      should.exist(tt.getMetrics('Custom/Test01'));
    });

    it("should allow multiple traces for same name", function () {
      var TRACE_NAME = 'Custom/Test02'
        , tt = transaction.create(agent)
        , traces = []
        ;

      for (var i = 0; i < 5; i++) {
        traces[i] = tt.measure(TRACE_NAME);
        traces[i].end();
      }

      tt.end();

      expect(tt.getStatistics(TRACE_NAME).toObject().calls).to.equal(traces.length);
    });

    it("should allow multiple overlapping traces for same name", function (done) {
      var TRACE_NAME = 'Custom/Test06'
        , SLEEP_DURATION = 43
        , tt = transaction.create(agent)
        ;

      var first = tt.measure(TRACE_NAME);
      var second = tt.measure(TRACE_NAME);
      second.end();

      setTimeout(function () {
        // this will automatically close out any open transactions,
        // so in this case will close the first transaction
        tt.end();

        var statistics = tt.getStatistics(TRACE_NAME).toObject();
        expect(statistics.calls).to.equal(2);
        expect(statistics.max).to.be.above(SLEEP_DURATION - 1);

        return done();
      }, SLEEP_DURATION);
    });

    it("shouldn't trace calls added after the transaction has finished", function () {
      var tt = transaction.create(agent);

      tt.measure('Custom/Test03');
      tt.end();

      tt.measure('Custom/Test04');
      should.not.exist(tt.getMetrics('Custom/Test04'));
    });

    it("should allow manual setting of trace durations", function () {
      var tt = transaction.create(agent);

      var trace = tt.measure('Custom/Test16');
      trace.setDurationInMillis(65);

      tt.end();

      var metrics = tt.getMetrics('Custom/Test16');
      expect(metrics.length).to.equal(1);
      metrics[0].getDurationInMillis().should.equal(65);
    });

    describe("when adding child traces", function () {
      var tt;

      beforeEach(function () {
        tt = transaction.create(agent);
      });

      it("should allow child traces on an existing trace", function () {
        var trace = tt.measure('Custom/Test17');

        expect(function () { trace.addChild('Custom/Test17/Child1'); }).not.throws();
      });

      it("should measure exclusive time vs total time", function () {
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

    describe("when fetching statistics", function () {
      it("should return statistics properly", function () {
        var tt = transaction.create(agent);

        tt.measure('Custom/Test05');
        tt.end();

        expect(tt.getStatistics('Custom/Test05').calls).to.equal(1);
      });
    });
  });

  describe("when producing a summary of the whole transaction", function () {
    var tt;

    beforeEach(function () {
      tt = transaction.create(agent);

      // scoped metrics
      tt.measure('Custom/Test11', 'TEST').end();
      tt.measure('Custom/Test12', 'TEST').end();
      tt.measure('Custom/Test11', 'ANOTHER').end();

      // unscoped metrics
      tt.measure('Custom/Lucky13').end();
      tt.measure('Custom/Lucky13').end();
      tt.measure('Custom/Lucky13').end();
      tt.measure('Custom/Test14').end();
      tt.measure('Custom/Test15').end();

      tt.end();
    });

    it("should be returned when statistics is called with no parameters", function () {
      var summary = tt.getStatistics();

      expect(summary.scoped.TEST['Custom/Test11'].toJSON()[0]).to.equal(1);
      expect(summary.scoped.TEST['Custom/Test12'].toJSON()[0]).to.equal(1);
      expect(summary.scoped.ANOTHER['Custom/Test11'].toJSON()[0]).to.equal(1);
      expect(summary.unscoped['Custom/Lucky13'].toJSON()[0]).to.equal(3);
      expect(summary.unscoped['Custom/Test14'].toJSON()[0]).to.equal(1);
      expect(summary.unscoped['Custom/Test15'].toJSON()[0]).to.equal(1);
    });

    it("should be returned when summary is called", function () {
      var summary = tt.summarize();

      expect(summary.scoped.TEST['Custom/Test11'].toJSON()[0]).to.equal(1);
      expect(summary.scoped.TEST['Custom/Test12'].toJSON()[0]).to.equal(1);
      expect(summary.scoped.ANOTHER['Custom/Test11'].toJSON()[0]).to.equal(1);
      expect(summary.unscoped['Custom/Lucky13'].toJSON()[0]).to.equal(3);
      expect(summary.unscoped['Custom/Test14'].toJSON()[0]).to.equal(1);
      expect(summary.unscoped['Custom/Test15'].toJSON()[0]).to.equal(1);
    });
  });

  it("should create a trace on demand");
});
