'use strict';

var path         = require('path')
  , chai         = require('chai')
  , should       = chai.should()
  , expect       = chai.expect
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper'))
  , configurator = require(path.join(__dirname, '..', 'lib', 'config'))
  , logger       = require(path.join(__dirname, '..', 'lib', 'logger'))
      .child({component : 'TEST'})
  , Agent        = require(path.join(__dirname, '..', 'lib', 'agent'))
  ;

describe("the New Relic agent", function () {
  it("accepts a custom configuration as an option passed to the constructor",
     function () {
    var config = configurator.initialize(logger, {
      config : {
        sample : true
      }
    });
    var agent = new Agent({config : config});

    expect(agent.config.sample).equal(true);
  });

  describe("at connection time", function () {
    var agent;

    beforeEach(function () {
      agent = new Agent();
    });

    it("should retry on connection failure", function (done) {
      // _nextConnectAttempt requires agent.connection exist
      agent.setupConnection();

      agent._failAndRetry = function () {
        return done();
      };

      var backoff = agent.nextBackoff();
      expect(backoff).eql({interval : 15, warn : false, error : false});

      agent._nextConnectAttempt(backoff);

      should.exist(agent.connection);
      agent.connection.emit('connectError', 'testConnect', new Error('agent test'));
    });

    it("should give up after retrying 6 times", function (done) {
      // _nextConnectAttempt requires agent.connection exist
      agent.setupConnection();

      agent._failAndShutdown = function () {
        return done();
      };
      agent.connectionFailures = 6;

      var backoff = agent.nextBackoff();
      expect(backoff).eql({interval : 300, warn : false, error : true});

      agent._nextConnectAttempt(backoff);

      should.exist(agent.connection);
      agent.connection.emit('connectError', 'testConnect', new Error('agent test'));
    });
  });

  describe("when working offline with a mocked service connection", function () {
    var agent
      , connection
      ;

    beforeEach(function (done) {
      agent = helper.loadMockedAgent();

      agent.on('connect', function () {
        connection = agent.connection;
        should.exist(connection);

        return done();
      });

      agent.start();
    });

    afterEach(function () {
      helper.unloadAgent(agent);
    });

    it("exposes its summary metrics", function () {
      should.exist(agent.metrics);
    });

    it("exposes its configuration", function () {
      should.exist(agent.config);
    });

    it("exposes its error service", function () {
      should.exist(agent.errors);
    });

    it("exposes its slow trace aggregator", function () {
      should.exist(agent.traces);
    });

    it("exposes its configured metric normalizer via the default metrics", function () {
      should.exist(agent.metrics.normalizer);
    });

    it("creates its own transactions directly", function () {
      expect(function () { agent.createTransaction(); }).not.throws();
    });

    it("should look up transactions itself", function () {
      var transaction;
      expect(function () {
        transaction = agent.createTransaction();
      }).not.throws();
    });

    it("should have debugging configuration by default", function () {
      expect(agent.config.debug).not.equal(undefined);
    });

    describe("with debugging configured", function () {
      it("should have internal instrumentation disabled by default", function () {
        var debug = agent.config.debug;
        expect(debug.internal_metrics).equal(false);
      });

      it("can be created with internal instrumentation enabled in the configuration",
         function () {
        var config = configurator.initialize(logger, {
          config : {debug : {internal_metrics : true}}
        });
        var debugged = new Agent({config : config});

        var debug = debugged.config.debug;
        expect(debug.internal_metrics).equal(true);
      });

      describe("with internal instrumentation enabled", function () {
        var debugged;

        beforeEach(function () {
          var config = configurator.initialize(logger, {
            config : {debug : {internal_metrics : true}}
          });
          debugged = new Agent({config : config});
        });

        it("should have an object for tracking internal metrics", function () {
          expect(debugged.config.debug.supportability).not.equal(undefined);
        });

        it("should find an internal metric for transaction processed", function (done) {
          debugged.once('transactionFinished', function () {
            var supportability = debugged.config.debug.supportability
              , metric = supportability.getMetric('Supportability/Transaction/Count')
              ;

            expect(metric, 'is defined').not.equal(undefined);
            expect(metric.stats.callCount, 'has been incremented').equal(1);

            return done();
          });

          var transaction = debugged.createTransaction();
          transaction.end();
        });
      });
    });

    describe("when handling events", function () {
      it("should update the metrics' apdex tolerating value when configuration changes",
         function (done) {
        expect(agent.metrics.apdexT).equal(0.5);
        process.nextTick(function () {
          should.exist(agent.metrics.apdexT);
          agent.metrics.apdexT.should.equal(0.666);

          return done();
        });

        agent.config.emit('change', {'apdex_t' : 0.666});
      });

      it("should reset the configuration and metrics normalizer on connection",
         function (done) {
        expect(agent.config.apdex_t).equal(0.5);
        process.nextTick(function () {
          expect(agent.config.apdex_t).equal(0.742);
          expect(agent.metrics.apdexT).equal(0.742);
          expect(agent.metrics.normalizer.rules).deep.equal([]);

          return done();
        });

        connection.emit('connect', {apdex_t : 0.742, url_rules : []});
      });

      it("should parse metrics responses when metric data is received",
         function (done) {
        var NAME     = 'Custom/Test/events';
        var SCOPE    = 'TEST';
        var METRICID = 'Test/Rollup';

        var testIDs = {};
        testIDs[NAME + ',' + SCOPE] = METRICID;

        agent.metrics.renamer.length.should.equal(0);
        process.nextTick(function () {
          agent.metrics.renamer.lookup(NAME, SCOPE).should.equal('Test/Rollup');

          return done();
        });

        connection.emit('metricDataResponse',
                        [[{name : NAME, scope : SCOPE}, METRICID]]);
      });

      it("should capture the trace off a finished transaction", function (done) {
        var trans = agent.createTransaction();
        // need to initialize the trace
        trans.getTrace();
        trans.measureWeb('/ham/update/3', 200, 2100);

        agent.once('transactionFinished', function () {
          var trace = agent.traces.trace;
          should.exist(trace);
          expect(trace.getDurationInMillis(), "same trace just passed in").equal(2100);

          return done();
        });

        trans.end();
      });

      it("should have three handlers registered for transactionFinished", function () {
        // one to merge metrics
        // one to update error counts
        // one to pass finished traces to the slow trace aggregator
        agent.listeners('transactionFinished').length.should.equal(3);
      });
    });

    describe("when apdex_t changes", function () {
      var APDEX_T = 0.9876;

      it("should update its own apdexT", function () {
        expect(agent.apdexT).not.equal(APDEX_T);

        agent.onApdexTChange({apdex_t : APDEX_T});

        expect(agent.apdexT).equal(APDEX_T);
      });

      it("should update the current metrics collection's apdexT", function () {
        expect(agent.metrics.apdexT).not.equal(APDEX_T);

        agent.onApdexTChange({apdex_t : APDEX_T});

        expect(agent.metrics.apdexT).equal(APDEX_T);
      });
    });

    describe("when new metric name -> ID renaming rules may or may not have come in",
             function () {
      it("shouldn't throw if no new rules are received", function () {
        expect(function () { agent.onNewRenameRules(null); }).not.throws();
      });

      it("shouldn't throw if new rules are received", function () {
        var rules = [[{name : 'Test/RenameMe1'}, 1001],
                     [{name : 'Test/RenameMe2', scope : 'TEST'}, 1002]];

        expect(function () { agent.onNewRenameRules(rules); }).not.throws();
      });
    });

    describe("when new metric normalization rules may or may not have come in",
             function () {
      it("shouldn't throw if no new rules are received", function () {
        expect(function () { agent.onNewNormalizationRules(null); }).not.throws();
      });

      it("shouldn't throw if new rules are received", function () {
        var rules = {
          url_rules : [
            {each_segment : false, eval_order : 0, terminate_chain : true,
             match_expression : '^(test_match_nothing)$',
             replace_all : false, ignore : false, replacement : '\\1'},
            {each_segment : false, eval_order : 0, terminate_chain : true,
             match_expression : '.*\\.(css|gif|ico|jpe?g|js|png|swf)$',
             replace_all : false, ignore : false, replacement : '/*.\\1'},
            {each_segment : false, eval_order : 0, terminate_chain : true,
             match_expression : '^(test_match_nothing)$',
             replace_all : false, ignore : false, replacement : '\\1'}
          ]
        };

        expect(function () { agent.onNewNormalizationRules(rules); }).not.throws();
      });
    });
  });
});
