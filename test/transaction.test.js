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

  it("should have at most one associated trace");
  it("should have its own metrics");
  it("should hand the metrics off to the Agent metrics object upon finalization");

  describe("when dealing with individual traces", function () {
    it("should add metrics by name", function () {
      var tt = transaction.create(agent);

      tt.measure('Custom/Test01');
      should.exist(tt.getMetrics('Custom/Test01'));
    });

    it("should allow multiple metric measurements for same name", function () {
      var TRACE_NAME = 'Custom/Test02'
        , tt = transaction.create(agent)
        , traces = []
        ;

      for (var i = 0; i < 5; i++) {
        traces[i] = tt.measure(TRACE_NAME);
        traces[i].end();
      }

      tt.end();

      // FIXME: expect(tt.getStatistics(TRACE_NAME).toObject().calls).to.equal(traces.length);
    });

    it("should allow multiple overlapping metric measurements for same name", function (done) {
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

        var statistics = tt.getMetrics(TRACE_NAME)[0];
        // FIXME: these are obsolete now -- need to adapt
        // expect(statistics.calls).to.equal(2);
        // expect(statistics.max).to.be.above(SLEEP_DURATION - 1);

        return done();
      }, SLEEP_DURATION);
    });

    it("shouldn't measure metrics gathered after the transaction has finished", function () {
      var tt = transaction.create(agent);

      tt.measure('Custom/Test03');
      tt.end();

      tt.measure('Custom/Test04');
      should.not.exist(tt.getMetrics('Custom/Test04'));
    });

    it("should allow manual setting of metric durations", function () {
      var tt = transaction.create(agent);

      var trace = tt.measure('Custom/Test16');
      trace.setDurationInMillis(65);

      tt.end();

      var metrics = tt.getMetrics('Custom/Test16');
      expect(metrics.length).to.equal(1);
      metrics[0].getDurationInMillis().should.equal(65);
    });
  });

  describe("when producing a summary of the whole transaction", function () {
    it("should produce a human-readable summary");
    it("should produce a metrics summary suitable for the collector");
  });

  it("should create a trace on demand");
});
