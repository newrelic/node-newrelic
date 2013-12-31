'use strict';

var path                = require('path')
  , sinon               = require('sinon')
  , chai                = require('chai')
  , should              = chai.should()
  , expect              = chai.expect
  , helper              = require(path.join(__dirname, 'lib', 'agent_helper'))
  , configurator        = require(path.join(__dirname, '..', 'lib', 'config'))
  , logger              = require(path.join(__dirname, '..', 'lib', 'logger'))
                            .child({component : 'TEST'})
  , Agent               = require(path.join(__dirname, '..', 'lib', 'agent'))
  , Transaction         = require(path.join(__dirname, '..', 'lib', 'transaction'))
  , Metrics             = require(path.join(__dirname, '..', 'lib', 'metrics'))
  , CollectorConnection = require(path.join(__dirname, '..', 'lib',
                                            'collector', 'connection'))
  ;

describe("the New Relic agent", function () {
  it("requires the configuration be passed to the constructor",
     function () {
    var config = configurator.initialize(logger, {config : {agent_enabled : false}});
    var agent = new Agent(config);

    expect(agent.config.agent_enabled).equal(false);
  });

  describe("when connecting to the collector", function () {
    var agent;

    beforeEach(function () {
      var config = configurator.initialize(logger, {config : {sample : true}});
      agent = new Agent(config);
    });

    it("retries on failure", function (done) {
      // _nextConnectAttempt requires that agent.connection exist
      agent.setupConnection();

      agent._failAndRetry = function () { return done(); };

      var backoff = agent.nextBackoff();
      expect(backoff).eql({interval : 15, warn : false, error : false});

      agent._nextConnectAttempt(backoff);

      agent.connection.emit('connectError', 'testConnect', new Error('agent test'));
    });

    it("gives up after retrying 6 times", function (done) {
      // _nextConnectAttempt requires agent.connection exist
      agent.setupConnection();

      agent._failAndShutdown = function () { return done(); };
      agent.connectionFailures = 6;

      var backoff = agent.nextBackoff();
      expect(backoff).eql({interval : 300, warn : false, error : true});

      agent._nextConnectAttempt(backoff);

      agent.connection.emit('connectError', 'testConnect', new Error('agent test'));
    });
  });

  describe("when handling connection failures", function () {
    var agent
      , error
      ;

    function HulkObject() {}
    HulkObject.prototype.toJSON = function () {
      throw new Error("You wouldn't like me when I'm serialized.");
    };

    beforeEach(function () {
      agent = helper.loadMockedAgent();
      error = new Error('test error');
      error.stylee = new HulkObject();
    });

    afterEach(function () {
      helper.unloadAgent(agent);
    });

    it("shouldn't blow up when merging metrics with no error", function () {
      expect(function () {
        agent.mergeMetrics([0, 0, 0, agent.metrics], null);
      }).not.throws();
    });

    it("shouldn't blow up when merging metrics with a weird error", function () {
      expect(function () {
        agent.mergeMetrics([0, 0, 0, agent.metrics], error);
      }).not.throws();
    });

    it("shouldn't blow up when merging errors with no error", function () {
      expect(function () {
        agent.mergeErrors([], null);
      }).not.throws();
    });

    it("shouldn't blow up when merging errors with a weird error", function () {
      expect(function () {
        agent.mergeErrors([], error);
      }).not.throws();
    });
  });

  describe("with a stubbed collector connection", function () {
    var agent
      , connection
      ;

    beforeEach(function (done) {
      agent = helper.loadMockedAgent();

      agent.on('connect', function () {
        connection = agent.connection;

        return done();
      });

      agent.start();
    });

    afterEach(function () {
      helper.unloadAgent(agent);
    });

    it("bootstraps its configuration", function () {
      should.exist(agent.config);
    });

    it("still has a connection, which is stubbed", function () {
      should.exist(connection);
    });

    it("has an error tracer", function () {
      should.exist(agent.errors);
    });

    it("uses an aggregator to apply top N slow trace logic", function () {
      should.exist(agent.traces);
    });

    it("has a URL normalizer", function () {
      should.exist(agent.urlNormalizer);
    });

    it("has a metric name normalizer", function () {
      should.exist(agent.metricNameNormalizer);
    });

    it("has a transaction name normalizer", function () {
      should.exist(agent.transactionNameNormalizer);
    });

    it("has a consolidated metrics collection that transactions feed into", function () {
      should.exist(agent.metrics);
    });

    it("has a function to look up the active transaction", function () {
      expect(function () { agent.getTransaction(); }).not.throws();
    });

    it("has some debugging configuration by default", function () {
      should.exist(agent.config.debug);
    });

    describe("with debugging configured", function () {
      it("internal instrumentation is disabled by default", function () {
        var debug = agent.config.debug;
        expect(debug.internal_metrics).equal(false);
      });

      it("internal instrumentation can be configured",
         function () {
        var config = configurator.initialize(logger, {
          config : {debug : {internal_metrics : true}}
        });
        var debugged = new Agent(config);

        var debug = debugged.config.debug;
        expect(debug.internal_metrics).equal(true);
      });

      describe("with internal instrumentation enabled", function () {
        var debugged;

        beforeEach(function () {
          var config = configurator.initialize(logger, {
            config : {debug : {internal_metrics : true}}
          });
          debugged = new Agent(config);
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
            expect(metric.callCount, 'has been incremented').equal(1);

            return done();
          });

          var transaction = new Transaction(debugged);
          transaction.end();
        });
      });
    });

    describe("with naming rules configured", function () {
      var configured;
      beforeEach(function () {
        var config = configurator.initialize(logger, {
          config : {rules : {name : [
            {pattern : '^/t',  name : 'u'},
            {pattern : /^\/u/, name : 't'}
          ]}}
        });
        configured = new Agent(config);
      });

      it("loads the rules", function () {
        var rules = configured.userNormalizer.rules;
        expect(rules.length).equal(2);
        // because of unshift, rules are in reverse of config order
        expect(rules[0].pattern.source).equal('^\\/u');
        expect(rules[1].pattern.source).equal('^/t');
      });
    });

    describe("with ignoring rules configured", function () {
      var configured;
      beforeEach(function () {
        var config = configurator.initialize(logger, {
          config : {rules : {ignore : [
            /^\/ham_snadwich\/ignore/
          ]}}
        });
        configured = new Agent(config);
      });

      it("loads the rules", function () {
        var rules = configured.userNormalizer.rules;
        expect(rules.length).equal(1);
        expect(rules[0].pattern.source).equal('^\\/ham_snadwich\\/ignore');
        expect(rules[0].ignore).equal(true);
      });
    });

    describe("when handling events", function () {
      it("should update the metrics' apdex tolerating value when configuration changes",
         function (done) {
        expect(agent.metrics.apdexT).equal(0.1);
        process.nextTick(function () {
          should.exist(agent.metrics.apdexT);
          expect(agent.metrics.apdexT).equal(0.666);

          return done();
        });

        agent.config.emit('apdex_t', 0.666);
      });

      it("should reset the configuration and metrics normalizer on connection",
         function (done) {
        expect(agent.config.apdex_t).equal(0.1);
        process.nextTick(function () {
          expect(agent.metrics.apdexT).equal(0.742);
          expect(agent.urlNormalizer.rules).deep.equal([]);

          return done();
        });

        connection.emit('connect', {apdex_t : 0.742, url_rules : []});
      });

      it("should parse metrics responses when metric data is received",
         function (done) {
        var NAME     = 'Custom/Test/events';
        var SCOPE    = 'TEST';
        var METRICID = 17;

        var testIDs = {};
        testIDs[NAME + ',' + SCOPE] = METRICID;

        expect(agent.mapper.length).equal(0);
        process.nextTick(function () {
          expect(agent.mapper.map(NAME, SCOPE)).equal(17);

          return done();
        });

        connection.emit('metricDataResponse',
                        [[{name : NAME, scope : SCOPE}, METRICID]]);
      });

      it("should capture the trace off a finished transaction", function (done) {
        var trans = new Transaction(agent);
        // need to initialize the trace
        trans.getTrace().setDurationInMillis(2100);

        agent.once('transactionFinished', function () {
          var trace = agent.traces.trace;
          should.exist(trace);
          expect(trace.getDurationInMillis(), "same trace just passed in").equal(2100);

          return done();
        });

        trans.end();
      });
    });

    describe("when apdex_t changes", function () {
      var APDEX_T = 0.9876;

      it("should update the current metrics collection's apdexT", function () {
        expect(agent.metrics.apdexT).not.equal(APDEX_T);

        agent.onApdexTChange(APDEX_T);

        expect(agent.metrics.apdexT).equal(APDEX_T);
      });
    });

    describe("when new metric name -> ID mappings may or may not have come in",
             function () {
      it("shouldn't throw if no new rules are received", function () {
        expect(function () { agent.onNewMappings(null); }).not.throws();
      });

      it("shouldn't throw if new rules are received", function () {
        var rules = [[{name : 'Test/RenameMe1'}, 1001],
                     [{name : 'Test/RenameMe2', scope : 'TEST'}, 1002]];

        expect(function () { agent.onNewMappings(rules); }).not.throws();
      });
    });

    describe("when handling finished transactions", function () {
      var transaction;

      beforeEach(function () {
        transaction = new Transaction(agent);
        transaction.ignore = true;
      });

      it("shouldn't merge metrics when transaction is ignored", function () {
        /* Top-level method is bound into EE, so mock the metrics collection
         * instead.
         */
        var mock = sinon.mock(agent.metrics);
        mock.expects('merge').never();

        transaction.end();
      });

      it("shouldn't merge errors when transaction is ignored", function () {
        /* Top-level method is bound into EE, so mock the error tracer instead.
         */
        var mock = sinon.mock(agent.errors);
        mock.expects('onTransactionFinished').never();

        transaction.end();
      });

      it("shouldn't aggregate trace when transaction is ignored", function () {
        /* Top-level *and* second-level methods are bound into EEs, so mock the
         * transaction trace getter instead.
         */
        var mock = sinon.mock(transaction);
        mock.expects('getTrace').never();

        transaction.end();
      });
    });
  });

  describe("with a mocked connection", function () {
    var agent
      , mock
      ;

    beforeEach(function () {
      var connection = new CollectorConnection({
        config : {
          applications : function () { return 'none'; },
          run_id : '1337'
        }
      });

      mock = sinon.mock(connection);

      var config = configurator.initialize(logger, {config : {sample : true}});
      agent = new Agent(config, {connection : connection});
      agent.setupConnection();
    });

    afterEach(function () {
      mock.expects('send').once().withArgs('shutdown');

      agent.stop();
      mock.verify();
    });

    describe("when sending data to the collector", function () {
      it("the last reported time is congruent with reality", function () {
        mock.expects('sendMetricData').once().withExactArgs(agent.metrics);

        agent.submitMetricData();
      });
    });

    describe("when harvesting", function () {
      it("sends transactions to the new error handler after harvest", function (done) {
        agent.metrics.started = 1337;

        agent.harvest();

        var transaction = new Transaction(agent);
        agent.errors = {
          onTransactionFinished : function (t) {
            expect(t).equal(transaction);
            return done();
          }
        };

        agent.emit('transactionFinished', transaction);
      });

      it("reports the error count", function () {
        agent.metrics.started = 1337;

        var transaction = new Transaction(agent);
        transaction.name = 'WebTransaction/NormalizedUri/test';
        transaction.statusCode = 501;
        agent.errors.add(transaction, new TypeError('no method last on undefined'));
        agent.errors.add(transaction, new Error('application code error'));
        agent.errors.add(transaction, new RangeError('stack depth exceeded'));
        transaction.end();

        var metrics = new Metrics(0.1, agent.mapper, agent.metricNameNormalizer);
        metrics.started = 1337;
        metrics.getOrCreateMetric('Errors/all').incrementCallCount(3);
        metrics
          .getOrCreateMetric('Errors/WebTransaction/NormalizedUri/test')
          .incrementCallCount(1);

        mock.expects('sendMetricData').once().withArgs(metrics);
        mock.expects('sendTracedErrors').once();
        mock.expects('sendTransactionTraces').once();

        agent.harvest();
      });

      it("doesn't try to send errors when error tracer disabled", function () {
        var transaction = new Transaction(agent);
        transaction.statusCode = 501;
        agent.errors.add(transaction, new TypeError('no method last on undefined'));
        agent.errors.add(transaction, new Error('application code error'));
        agent.errors.add(transaction, new RangeError('stack depth exceeded'));
        transaction.end();

        mock.expects('sendMetricData').once();
        mock.expects('sendTracedErrors').never();
        mock.expects('sendTransactionTraces').once();

        // do this here so error traces get collected but not sent
        agent.config.onConnect({'error_collector.enabled' : false});

        agent.harvest();
        agent.config.error_collector.enabled = true;
      });

      it("doesn't try to send errors when server disables collect_errors", function () {
        var transaction = new Transaction(agent);
        transaction.statusCode = 501;
        agent.errors.add(transaction, new TypeError('no method last on undefined'));
        agent.errors.add(transaction, new Error('application code error'));
        agent.errors.add(transaction, new RangeError('stack depth exceeded'));
        transaction.end();

        mock.expects('sendMetricData').once();
        mock.expects('sendTracedErrors').never();
        mock.expects('sendTransactionTraces').once();

        // do this here so error traces get collected but not sent
        agent.config.onConnect({collect_errors : false});

        agent.harvest();
        agent.config.error_collector.enabled = true;
      });

      it("doesn't try to send transaction traces when transaction tracer disabled",
         function () {
        var transaction = new Transaction(agent);
        transaction.setName('/test/path/31337', 501);
        agent.errors.add(transaction, new TypeError('no method last on undefined'));
        agent.errors.add(transaction, new Error('application code error'));
        agent.errors.add(transaction, new RangeError('stack depth exceeded'));
        transaction.end();

        mock.expects('sendMetricData').once();
        mock.expects('sendTracedErrors').once();
        mock.expects('sendTransactionTraces').never();

        // do this here so slow trace gets collected but not sent
        agent.config.onConnect({'transaction_tracer.enabled' : false});

        agent.harvest();
        agent.config.transaction_tracer.enabled = true;
      });

      it("doesn't try to send transaction traces when server disables collect_traces",
         function () {
        var transaction = new Transaction(agent);
        transaction.setName('/test/path/31337', 501);
        agent.errors.add(transaction, new TypeError('no method last on undefined'));
        agent.errors.add(transaction, new Error('application code error'));
        agent.errors.add(transaction, new RangeError('stack depth exceeded'));
        transaction.end();

        mock.expects('sendMetricData').once();
        mock.expects('sendTracedErrors').once();
        mock.expects('sendTransactionTraces').never();

        // set this here so slow trace gets collected but not sent
        agent.config.onConnect({collect_traces : false});

        agent.harvest();
        agent.config.transaction_tracer.enabled = true;
      });
    });
  });
});
