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
    expect(trans.trace).equal(undefined);
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

    it("should have the same metric renaming rules as the agent's", function () {
      expect(agent.metrics.renamer).equal(trans.metrics.renamer);
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

  it("shouldn't crash when measuring URL paths without a leading slash", function () {
    var trans = new Transaction(agent);
    expect(function () {
      trans.measureWeb('?t_u=http://some.com/o/p', 200, 1);
      expect(trans.url).equal('/');
    }).not.throws();
  });

  describe("when dealing with individual metrics", function () {
    it("should add metrics by name", function () {
      var tt = agent.createTransaction();

      tt.measure('Custom/Test01');
      should.exist(tt.getMetrics('Custom/Test01'));

      tt.end();
    });

    it("should allow multiple overlapping metric measurements for same name",
       function () {
      var TRACE_NAME = 'Custom/Test06'
        , SLEEP_DURATION = 43
        , tt = agent.createTransaction()
        ;

      tt.measure(TRACE_NAME, null, SLEEP_DURATION);
      tt.measure(TRACE_NAME, null, SLEEP_DURATION - 5);

      var statistics = tt.getMetrics(TRACE_NAME).stats;
      expect(statistics.callCount).to.equal(2);
      expect(statistics.max).above((SLEEP_DURATION - 1) / 1000);
    });

    it("should allow manual setting of metric durations", function () {
      var tt = agent.createTransaction();

      tt.measure('Custom/Test16', null, 65);
      tt.end();

      var metrics = tt.getMetrics('Custom/Test16');
      metrics.stats.total.should.equal(0.065);
    });
  });

  describe("when recording web transactions", function () {
    describe("with normal requests", function () {
      it("should infer a satisfying end-user experience", function () {
        trans.metrics.apdexT = 0.06;
        trans.measureWeb('/test', 200, 55, 55);

        var result = [
          [{name : 'WebTransaction'},          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'HttpDispatcher'},          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'WebTransaction/Uri/test'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'Apdex/Uri/test'},          [1,     0,     0,  0.06,  0.06,        0]],
          [{name : 'Apdex'},                   [1,     0,     0,  0.06,  0.06,        0]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });

      it("should infer a tolerable end-user experience", function () {
        trans.metrics.apdexT = 0.05;
        trans.measureWeb('/test', 200, 55, 100);

        var result = [
          [{name : 'WebTransaction'},          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'HttpDispatcher'},          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'WebTransaction/Uri/test'}, [1, 0.055,   0.1, 0.055, 0.055, 0.003025]],
          [{name : 'Apdex/Uri/test'},          [0,     1,     0,  0.05,  0.05,        0]],
          [{name : 'Apdex'},                   [0,     1,     0,  0.05,  0.05,        0]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });

      it("should infer a frustrating end-user experience", function () {
        trans.metrics.apdexT = 0.01;
        trans.measureWeb('/test', 200, 55, 55);

        var result = [
          [{name : 'WebTransaction'},          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'HttpDispatcher'},          [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'WebTransaction/Uri/test'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'Apdex/Uri/test'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name : 'Apdex'},                   [0,     0,     1,  0.01,  0.01,        0]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });

      it("should chop query strings delimited by ? from request URLs", function () {
        trans.measureWeb('/test?test1=value1&test2&test3=50');

        expect(trans.url).equal('/test');
      });

      it("should chop query strings delimited by ; from request URLs", function () {
        trans.measureWeb('/test;jsessionid=c83048283dd1328ac21aed8a8277d');

        expect(trans.url).equal('/test');
      });
    });

    describe("with exceptional requests", function () {
      it("should handle missing resources", function () {
        trans.metrics.apdexT = 0.01;
        trans.measureWeb('/test', 404, 55, 55);

        var result = [
          [{name : 'WebTransaction'},                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'HttpDispatcher'},                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'WebTransaction/StatusCode/404'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'Apdex/StatusCode/404'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name : 'Apdex'},                         [0,     0,     1,  0.01,  0.01,        0]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });

      it("should handle bad requests", function () {
        trans.metrics.apdexT = 0.01;
        trans.measureWeb('/test', 400, 55, 55);

        var result = [
          [{name : 'WebTransaction'},                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'HttpDispatcher'},                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'WebTransaction/StatusCode/400'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'Apdex/StatusCode/400'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name : 'Apdex'},                         [0,     0,     1,  0.01,  0.01,        0]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });

      it("should handle over-long URIs", function () {
        trans.metrics.apdexT = 0.01;
        trans.measureWeb('/test', 414, 55, 55);

        var result = [
          [{name : 'WebTransaction'},                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'HttpDispatcher'},                [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'WebTransaction/StatusCode/414'}, [1, 0.055, 0.055, 0.055, 0.055, 0.003025]],
          [{name : 'Apdex/StatusCode/414'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name : 'Apdex'},                         [0,     0,     1,  0.01,  0.01,        0]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });

      it("should handle internal server errors", function () {
        trans.metrics.apdexT = 0.01;
        trans.measureWeb('/test', 500, 1, 1);

        var result = [
          [{name : 'WebTransaction'},          [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
          [{name : 'HttpDispatcher'},          [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
          [{name : 'WebTransaction/Uri/test'}, [1, 0.001, 0.001, 0.001, 0.001, 0.000001]],
          [{name : 'Apdex/Uri/test'},          [0,     0,     1,  0.01,  0.01,        0]],
          [{name : 'Apdex'},                   [0,     0,     1,  0.01,  0.01,        0]]
        ];
        expect(JSON.stringify(trans.metrics)).equal(JSON.stringify(result));
      });
    });
  });

  describe("when producing a summary of the whole transaction", function () {
    it("should produce a human-readable summary");
    it("should produce a metrics summary suitable for the collector");
  });

  it("should scope web transactions to their URL");
});
