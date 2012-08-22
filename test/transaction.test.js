'use strict';

var path        = require('path')
  , chai        = require('chai')
  , should      = chai.should()
  , expect      = chai.expect
  , helper      = require(path.join(__dirname, 'lib', 'agent_helper'))
  , transaction = require(path.join(__dirname, '..', 'lib', 'transaction', 'manager'))
  , Metrics     = require(path.join(__dirname, '..', 'lib', 'metrics'))
  , Trace       = require(path.join(__dirname, '..', 'lib', 'trace'))
  , Transaction = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

describe("Transaction", function () {
  var agent
    , trans
    ;

  beforeEach(function () {
    agent = helper.loadMockedAgent();
    trans = new Transaction(agent);
  });

  it("should be created without an associated trace", function () {
    expect(trans.trace).equal(undefined);
  });

  it("should create a trace on demand", function () {
    var trace = trans.getTrace();
    expect(trace).instanceOf(Trace);
    expect(trans.trace).equal(trace);
  });

  it("should have at most one associated trace", function () {
    var trace = trans.getTrace();
    expect(trans.trace).not.instanceof(Array);
  });

  it("should hand its metrics off to the agent upon finalization", function (done) {
    agent.on('transactionFinished', function (metrics) {
      expect(metrics).equal(trans.metrics);

      return done();
    });

    trans.end();
  });

  describe("with associated metrics", function () {
    it("should manage its own independent of the agent", function () {
      expect(trans.metrics).instanceOf(Metrics);
      expect(trans.metrics).not.equal(agent.metrics);
    });

    it("should have the same apdex threshold as the agent's", function () {
      expect(agent.metrics.apdexT).equal(trans.metrics.apdexT);
    });

    it("should have the same metric renaming rules as the agent's", function () {
      expect(agent.metrics.renamer).equal(trans.metrics.renamer);
    });
  });

  it("should provide a mechanism to associate itself with a URL", function () {
    var trans = new Transaction(agent);
    expect(function () { trans.setURL('/test/1'); }).not.throws();
  });

  it("should know when it's not a web transaction", function () {
    var trans = new Transaction(agent);
    expect(trans.isWeb()).equal(false);
  });

  it("should know when it's a web transaction", function () {
    var trans = new Transaction(agent);
    trans.setURL('/test/1');
    expect(trans.isWeb()).equal(true);
  });

  describe("when dealing with individual metrics", function () {
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

      var trace = tt.measure('Custom/Test16', null, 65);
      tt.end();

      var metrics = tt.getMetrics('Custom/Test16');
      metrics.stats.total.should.equal(0.065);
    });
  });

  describe("when producing a summary of the whole transaction", function () {
    it("should produce a human-readable summary");
    it("should produce a metrics summary suitable for the collector");
  });
});
