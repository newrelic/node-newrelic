'use strict';

var path        = require('path')
  , chai        = require('chai')
  , should      = chai.should()
  , expect      = chai.expect
  , helper      = require(path.join(__dirname, 'lib', 'agent_helper'))
  , Metrics     = require(path.join(__dirname, '..', 'lib', 'metrics'))
  , Trace       = require(path.join(__dirname, '..', 'lib', 'transaction', 'trace'))
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

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  it("should require an agent to create new transactions", function () {
    var trans;
    expect(function () {
      trans = new Transaction();
    }).throws(/must be bound to the agent/);
  });

  it("should be created without an associated trace", function () {
    should.not.exist(trans.trace);
  });

  it("should create a trace on demand", function () {
    var trace = trans.getTrace();
    expect(trace).instanceOf(Trace);
    expect(trans.trace).equal(trace);
  });

  it("should have at most one associated trace", function () {
    var trace = trans.getTrace();
    expect(trace).not.instanceof(Array);
  });

  it("should hand its metrics off to the agent upon finalization", function (done) {
    agent.on('transactionFinished', function (inner) {
      expect(inner.metrics).equal(trans.metrics);

      return done();
    });

    trans.end();
  });

  it("should hand itself off to the agent upon finalization", function (done) {
    agent.on('transactionFinished', function (inner) {
      expect(inner).equal(trans);

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

    it("should have the same metrics mapper as the agent's", function () {
      expect(agent.mapper).equal(trans.metrics.mapper);
    });
  });

  it("should know when it's not a web transaction", function () {
    var trans = new Transaction(agent);
    expect(trans.isWeb()).equal(false);
  });

  it("should know when it's a web transaction", function () {
    var trans = new Transaction(agent);
    trans.url = '/test/1';
    expect(trans.isWeb()).equal(true);
  });

  describe("when dealing with individual metrics", function () {
    it("should add metrics by name", function () {
      var tt = new Transaction(agent);

      tt.measure('Custom/Test01');
      should.exist(tt.metrics.getMetric('Custom/Test01'));

      tt.end();
    });

    it("should allow multiple overlapping metric measurements for same name",
       function () {
      var TRACE_NAME = 'Custom/Test06'
        , SLEEP_DURATION = 43
        , tt = new Transaction(agent)
        ;

      tt.measure(TRACE_NAME, null, SLEEP_DURATION);
      tt.measure(TRACE_NAME, null, SLEEP_DURATION - 5);

      var statistics = tt.metrics.getMetric(TRACE_NAME);
      expect(statistics.callCount).to.equal(2);
      expect(statistics.max).above((SLEEP_DURATION - 1) / 1000);
    });

    it("should allow manual setting of metric durations", function () {
      var tt = new Transaction(agent);

      tt.measure('Custom/Test16', null, 65);
      tt.end();

      var metrics = tt.metrics.getMetric('Custom/Test16');
      expect(metrics.total).equal(0.065);
    });
  });

  describe("when producing a summary of the whole transaction", function () {
    it("should produce a human-readable summary");
    it("should produce a metrics summary suitable for the collector");
  });

  it("shouldn't scope web transactions to their URL");
});
