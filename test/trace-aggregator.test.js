'use strict';

var path            = require('path')
  , chai            = require('chai')
  , expect          = chai.expect
  , helper          = require(path.join(__dirname, 'lib', 'agent_helper'))
  , TraceAggregator = require(path.join(__dirname, '..', 'lib', 'transaction', 'trace', 'aggregator'))
  , Transaction = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

describe('TraceAggregator', function () {
  it("should require a configuration at startup time", function () {
    expect(function () { var aggregator = new TraceAggregator(); }).throws();
    var config = {
      transaction_tracer : {
        enabled : true
      }
    };
    expect(function () { var aggregator = new TraceAggregator(config); }).not.throws();
  });

  describe("with top n support", function () {
    var config;

    beforeEach(function () {
      config = {
        transaction_tracer : {
          enabled : true
        }
      };
    });

    it("should set n from its configuration", function () {
      var TOP_N = 21;

      config.transaction_tracer.top_n = TOP_N;

      var aggregator = new TraceAggregator(config);
      expect(aggregator.size).equal(TOP_N);
    });

    it("should default to tracking the slowest transaction in a harvest period if top_n is undefined", function () {
      var aggregator = new TraceAggregator(config);
      expect(aggregator.size).equal(1);
    });

    it("should default to tracking the slowest transaction in a harvest period if top_n is 0", function () {
      config.transaction_tracer.top_n = 0;

      var aggregator = new TraceAggregator(config);
      expect(aggregator.size).equal(1);
    });

    it("should keep 1 transaction per harvest cycle");
    it("should only send a new trace for a given scope if it's slower than the old one");
  });

  it("should collect traces for transactions that exceed 4 * apdex_t", function (done) {
    var ABOVE_THRESHOLD = 29;
    var APDEXT = 0.007;

    var config = {
      transaction_tracer : {
        enabled : true,
        top_n : 10
      }
    };

    var aggregator  = new TraceAggregator(config)
      , agent       = helper.loadMockedAgent()
      , transaction = new Transaction(agent)
      , trace       = transaction.getTrace()
      ;

    // let's violating Law of Demeter!
    transaction.metrics.apdexT = APDEXT;
    transaction.measureWeb('/test', 200, ABOVE_THRESHOLD);

    aggregator.once('capture', function () {
      expect(aggregator.requestTimes['WebTransaction/Uri/test']).equal(ABOVE_THRESHOLD);

      return done();
    });
    aggregator.add(transaction);
  });

  it("should not collect traces for transactions that don't exceed 4 * apdex_t", function (done) {
    var BELOW_THRESHOLD = 27;
    var APDEXT = 0.007;

    var config = {
      transaction_tracer : {
        enabled : true,
        top_n : 10
      }
    };

    var aggregator  = new TraceAggregator(config)
      , agent       = helper.loadMockedAgent()
      , transaction = new Transaction(agent)
      , trace       = transaction.getTrace()
      ;

    // let's violating Law of Demeter!
    transaction.metrics.apdexT = APDEXT;
    transaction.measureWeb('/test', 200, BELOW_THRESHOLD);

    aggregator.once('capture', function () {
      expect(aggregator.requestTimes['WebTransaction/Uri/test']).equal(undefined);

      return done();
    });
    aggregator.add(transaction);
  });

  it("should have its own logical notion of a harvest cycle", function (done) {
    var config = {
      transaction_tracer : {
        enabled : true,
        top_n : 10
      }
    };

    var aggregator  = new TraceAggregator(config)
      , agent       = helper.loadMockedAgent()
      , transaction = new Transaction(agent)
      ;

    transaction.measureWeb('/test', 200, 418);
    var trace = transaction.getTrace();

    var deebeez = trace.add('DB/select/hodad');
    deebeez.setDurationInMillis(395, 5);

    transaction.end();

    aggregator.once('harvest', function firstHarvest(empty) {
      expect(empty).deep.equal([]);

      aggregator.once('capture', function firstCapture() {
        aggregator.once('harvest', function finalHarvest(traceData) {
          expect(traceData).an('array');
          expect(traceData.length).equal(1);
          expect(traceData[0]).an('array');

          return done();
        });
        aggregator.harvest();
      });
      expect(function addExists() { aggregator.add(transaction); }).not.throws();
    });
    expect(function harvestExists() { aggregator.harvest(); }).not.throws();
  });

  it("should group transactions by the metric name associated with the transaction", function (done) {
    var config = {
      transaction_tracer : {
        enabled : true,
        top_n : 10
      }
    };

    var aggregator  = new TraceAggregator(config)
      , agent       = helper.loadMockedAgent()
      , transaction = new Transaction(agent)
      , trace       = transaction.getTrace()
      ;

    transaction.measureWeb('/test', 200, 20);

    var segment = trace.add('DB/select/getSome');
    segment.setDurationInMillis(12, 2);

    aggregator.once('capture', function () {
      expect(aggregator.requestTimes['WebTransaction/Uri/test']).equal(20);

      return done();
    });
    aggregator.add(transaction);
  });

  it("should get track 5 different transactions between harvest cycle");
  describe("when request timings are tracked over time", function () {
    it("should reset the map after 5 harvest cycles with no slow transactions");
  });
});
