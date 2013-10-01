'use strict';

var path            = require('path')
  , chai            = require('chai')
  , expect          = chai.expect
  , should          = chai.should()
  , helper          = require(path.join(__dirname, 'lib', 'agent_helper'))
  , configurator    = require(path.join(__dirname, '..', 'lib', 'config'))
  , logger          = require(path.join(__dirname, '..', 'lib', 'logger'))
                        .child({component : 'TEST'})
  , TraceAggregator = require(path.join(__dirname, '..', 'lib',
                                        'transaction', 'trace', 'aggregator'))
  , Transaction     = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

describe('TraceAggregator', function () {
  var agent;

  function createTransaction(name, duration) {
    var transaction = new Transaction(agent);
    // gotta create the trace
    transaction.getTrace().setDurationInMillis(duration);
    transaction.url = name;
    transaction.name = 'WebTransaction/Uri' + name;
    transaction.statusCode = 200;
    transaction.end();

    return transaction;
  }

  beforeEach(function () {
    agent = helper.loadMockedAgent();
  });

  afterEach(function () {
    helper.unloadAgent(agent);
  });

  it("should require a configuration at startup time", function () {
    var aggregator;
    expect(function () { aggregator = new TraceAggregator(); }).throws();
    var config = configurator.initialize(logger, {
      config : {
        transaction_tracer : {
          enabled : true
        }
      }
    });

    expect(function () { aggregator = new TraceAggregator(config); }).not.throws();
  });

  it("shouldn't collect a trace if the tracer is disabled", function () {
    agent.config.transaction_tracer.enabled = false;
    agent.traces.add(createTransaction('/test', 3000));

    expect(agent.traces.trace).equal(null);
  });

  it("shouldn't collect a trace if collect_traces is false", function () {
    agent.config.collect_traces = false;
    agent.traces.add(createTransaction('/test', 3000));

    expect(agent.traces.trace).equal(null);
  });

  describe("with top n support", function () {
    var config;

    beforeEach(function () {
      config = configurator.initialize(logger, {
        config : {
          transaction_tracer : {
            enabled : true
          }
        }
      });
    });

    it("should set n from its configuration", function () {
      var TOP_N = 21;
      config.transaction_tracer.top_n = TOP_N;
      var aggregator = new TraceAggregator(config);

      expect(aggregator.capacity).equal(TOP_N);
    });

    it("should track the top 20 slowest transactions if top_n is unconfigured",
       function () {
      var aggregator = new TraceAggregator(config);

      expect(aggregator.capacity).equal(20);
    });

    it("should track the slowest transaction in a harvest period if top_n is 0",
       function () {
      config.transaction_tracer.top_n = 0;
      var aggregator = new TraceAggregator(config);

      expect(aggregator.capacity).equal(1);
    });

    it("should only save a trace for an existing name if new one is slower",
       function () {
      var URI = '/simple';
      var aggregator  = new TraceAggregator(config);
      aggregator.reported = 10; // needed to override "first 5"

      aggregator.add(createTransaction(URI, 3000));

      aggregator.add(createTransaction(URI, 2100));
      expect(aggregator.requestTimes['WebTransaction/Uri/simple'],
             'lower value').equal(3000);

      aggregator.add(createTransaction(URI, 4000));
      expect(aggregator.requestTimes['WebTransaction/Uri/simple'],
             'higher value').equal(4000);
    });

    it("should only track transactions for the top N names", function (done) {
      config.transaction_tracer.top_n = 5;
      var aggregator = new TraceAggregator(config);
      aggregator.reported = 10; // needed to override "first 5"

      aggregator.add(createTransaction('/testOne', 8000));
      aggregator.once('harvest', function (encoded) {
        expect(encoded, '1st harvest').an('array');
        aggregator.add(createTransaction('/testTwo', 8000));
        aggregator.once('harvest', function (encoded) {
          expect(encoded, '2nd harvest').an('array');
          aggregator.add(createTransaction('/testThr', 8000));
          aggregator.once('harvest', function (encoded) {
            expect(encoded, '3rd harvest').an('array');
            aggregator.add(createTransaction('/testFor', 8000));
            aggregator.once('harvest', function (encoded) {
              expect(encoded, '4th harvest').an('array');
              aggregator.add(createTransaction('/testF5v', 8000));
              aggregator.once('harvest', function (encoded) {
                expect(encoded, '5th harvest').an('array');
                // n = 5, so this sixth transaction is gonna lose
                aggregator.add(createTransaction('/testSix', 9000));
                aggregator.once('harvest', function (encoded) {
                  should.not.exist(encoded, '6th harvest');
                  expect(aggregator.requestTimes['WebTransaction/Uri/testOne'],
                         "1 of top 5").equal(8000);
                  expect(aggregator.requestTimes['WebTransaction/Uri/testTwo'],
                         "2 of top 5").equal(8000);
                  expect(aggregator.requestTimes['WebTransaction/Uri/testThr'],
                         "3 of top 5").equal(8000);
                  expect(aggregator.requestTimes['WebTransaction/Uri/testFor'],
                         "4 of top 5").equal(8000);
                  expect(aggregator.requestTimes['WebTransaction/Uri/testF5v'],
                         "5 of top 5").equal(8000);
                  should.not.exist(aggregator.requestTimes['WebTransaction/Uri/testSix'],
                                   "6 of top 5 -- OOPS");

                  return done();
                });
                aggregator.harvest();
              });
              aggregator.harvest();
            });
            aggregator.harvest();
          });
          aggregator.harvest();
        });
        aggregator.harvest();
      });
      aggregator.harvest();
    });
  });

  it("should collect traces for transactions that exceed apdex_f", function () {
    var ABOVE_THRESHOLD = 29;
    var APDEXT = 0.007;

    var config = configurator.initialize(logger, {
      config : {
        transaction_tracer : {
          enabled : true,
          top_n : 10
        }
      }
    });

    var aggregator  = new TraceAggregator(config)
      , transaction = new Transaction(agent)
      ;

    aggregator.reported = 10; // needed to override "first 5"

    // let's violating Law of Demeter!
    transaction.metrics.apdexT = APDEXT;
    transaction.getTrace().setDurationInMillis(ABOVE_THRESHOLD);
    transaction.url = '/test';
    transaction.name = 'WebTransaction/Uri/test';
    transaction.statusCode = 200;

    aggregator.add(transaction);
    expect(aggregator.requestTimes['WebTransaction/Uri/test']).equal(ABOVE_THRESHOLD);
  });

  it("should not collect traces for transactions that don't exceed apdex_f", function () {
    var BELOW_THRESHOLD = 27;
    var APDEXT = 0.007;

    var config = configurator.initialize(logger, {
      config : {
        transaction_tracer : {
          enabled : true,
          top_n   : 10
        }
      }
    });

    var aggregator  = new TraceAggregator(config)
      , transaction = new Transaction(agent)
      ;

    aggregator.reported = 10; // needed to override "first 5"

    // let's violating Law of Demeter!
    transaction.metrics.apdexT = APDEXT;
    transaction.getTrace().setDurationInMillis(BELOW_THRESHOLD);
    transaction.url = '/test';
    transaction.name = 'WebTransaction/Uri/test';
    transaction.statusCode = 200;

    aggregator.add(transaction);
    expect(aggregator.requestTimes['WebTransaction/Uri/test']).equal(undefined);
  });

  it("should collect traces for transactions that exceed explicit trace threshold",
     function () {
    var ABOVE_THRESHOLD = 29;
    var THRESHOLD = 0.028;

    var config = configurator.initialize(logger, {
      config : {
        transaction_tracer : {
          enabled               : true,
          transaction_threshold : THRESHOLD
        }
      }
    });

    var aggregator = new TraceAggregator(config);
    aggregator.reported = 10; // needed to override "first 5"
    aggregator.add(createTransaction('/test', ABOVE_THRESHOLD));

    expect(aggregator.requestTimes['WebTransaction/Uri/test']).equal(ABOVE_THRESHOLD);
  });

  it("should not collect traces for transactions that don't exceed trace threshold",
     function () {
    var BELOW_THRESHOLD = 29;
    var THRESHOLD = 30;

    var config = configurator.initialize(logger, {
      config : {
        transaction_tracer : {
          enabled               : true,
          transaction_threshold : THRESHOLD
        }
      }
    });

    var aggregator = new TraceAggregator(config);
    aggregator.reported = 10; // needed to override "first 5"
    aggregator.add(createTransaction('/test', BELOW_THRESHOLD));

    expect(aggregator.requestTimes['WebTransaction/Uri/test']).equal(undefined);
  });

  it("should have its own logical notion of a harvest cycle", function (done) {
    var config = configurator.initialize(logger, {
      config : {
        transaction_tracer : {
          enabled : true,
          top_n   : 10
        }
      }
    });

    var aggregator = new TraceAggregator(config);
    aggregator.once('harvest', function firstHarvest(empty) {
      expect(empty).equal(undefined);

      expect(function addExists() {
        aggregator.add(createTransaction('/test', 4180));
      }).not.throws();

      aggregator.once('harvest', function finalHarvest(traceData) {
        expect(traceData).an('array');
        expect(traceData.length).equal(8);
        expect(traceData[2]).equal('WebTransaction/Uri/test');

        return done();
      });

      aggregator.harvest();
    });

    expect(function harvestExists() { aggregator.harvest(); }).not.throws();
  });

  it("should group transactions by the metric name associated with the transaction",
     function () {
    var config = configurator.initialize(logger, {
      config : {
        transaction_tracer : {
          enabled : true,
          top_n   : 10
        }
      }
    });

    var aggregator  = new TraceAggregator(config);

    aggregator.add(createTransaction('/test', 2100));
    expect(aggregator.requestTimes['WebTransaction/Uri/test']).equal(2100);
  });

  it("should always report slow traces until 5 have been sent", function (done) {
    agent.config.apdex_t = 0;
    var config = configurator.initialize(logger, {
      config : {
        apdex_t : 0,
        transaction_tracer : {
          enabled : true
        }
      }
    });

    var aggregator = new TraceAggregator(config);

    var verifier = function (encoded, shouldExist) {
      if (shouldExist) {
        should.exist(encoded);
      }
      else {
        should.not.exist(encoded);
      }
    };

    aggregator.add(createTransaction('/testOne', 503));
    aggregator.once('harvest', function (encoded) {
      verifier(encoded, true);

      aggregator.add(createTransaction('/testTwo', 406));
      aggregator.once('harvest', function (encoded) {
        verifier(encoded, true);

        aggregator.add(createTransaction('/testThree', 720));
        aggregator.once('harvest', function (encoded) {
          verifier(encoded, true);

          aggregator.add(createTransaction('/testOne', 415));
          aggregator.once('harvest', function (encoded) {
            verifier(encoded, true);

            aggregator.add(createTransaction('/testTwo', 510));
            aggregator.once('harvest', function (encoded) {
              verifier(encoded, true);

              aggregator.add(createTransaction('/testOne', 502));
              aggregator.once('harvest', function (encoded) {
                verifier(encoded, false);

                return done();
              });
              aggregator.harvest();
            });
            aggregator.harvest();
          });
          aggregator.harvest();
        });
        aggregator.harvest();
      });
      aggregator.harvest();
    });
    aggregator.harvest();
  });

  describe("when request timings are tracked over time", function () {
    it("should reset timings after 5 harvest cycles with no slow traces",
       function (done) {
      var config = configurator.initialize(logger, {
        config : {
          transaction_tracer : {
            enabled : true
          }
        }
      });

      var aggregator = new TraceAggregator(config);
      aggregator.add(createTransaction('/test', 5030));

      var remaining = 4;
      // 2nd-5th harvests: no serialized trace, timing still set
      var looper = function (encoded) {
        expect(encoded).equal(undefined);
        expect(aggregator.requestTimes['WebTransaction/Uri/test'],
               "still churning").equal(5030);

        remaining -= 1;
        if (remaining === 0) {
          aggregator.removeListener('harvest', looper);

          // 6th harvest: no serialized trace, timings reset
          aggregator.once('harvest', function (encoded) {
            expect(encoded).equal(undefined);
            expect(aggregator.requestTimes['WebTransaction/Uri/test'],
                   "on the last pass").equal(undefined);

            return done();
          });
          aggregator.harvest();
        }
      };

      // 1st harvest: serialized trace, timing is set
      aggregator.once('harvest', function (encoded) {
        expect(encoded).not.equal(undefined);
        expect(aggregator.requestTimes['WebTransaction/Uri/test'],
               "still churning").equal(5030);

        aggregator.on('harvest', looper);
        for (var i = 0; i < 4; i++) aggregator.harvest();
      });
      aggregator.harvest();
    });
  });
});
