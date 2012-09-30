'use strict';

var path         = require('path')
  , chai         = require('chai')
  , should       = chai.should()
  , expect       = chai.expect
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper'))
  , configurator = require(path.join(__dirname, '..', 'lib', 'config'))
  , logger       = require(path.join(__dirname, '..', 'lib', 'logger')).child({component : 'TEST'})
  , Agent        = require(path.join(__dirname, '..', 'lib', 'agent'))
  , Transaction  = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

describe("the New Relic agent", function () {
  it("accepts a custom configuration as an option passed to the constructor", function () {
    var config = configurator.initialize(logger, {
      config : {
        sample : true
      }
    });
    var agent = new Agent({config : config});

    expect(agent.config.sample).equal(true);
  });

  describe("when establishing a connection to the staging collector", function () {
    var agent;

    before(function () {
      agent = helper.loadAgent();
    });

    after(function () {
      helper.unloadAgent(agent);
    });

    it("should start up properly", function (done) {
      should.exist(agent);

      agent.on('connect', function () {
        should.exist(agent.connection, 'connection exists');

        return done();
      });

      agent.start();
      agent.noticeAppPort(6666);
    });

    it("should give up after retrying x times");
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

      agent.noticeAppPort(6666);
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
      expect(transaction).instanceof(Transaction);
    });

    it("should have debugging configuration by default", function () {
      expect(agent.config.debug).not.equal(undefined);
    });

    describe("with debugging configured", function () {
      it("should have internal instrumentation disabled by default", function () {
        var debug = agent.config.debug;
        expect(debug.internal_metrics).equal(false);
      });

      it("can be created with internal instrumentation enabled in the configuration", function () {
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
            var metric = debugged.config.debug.supportability.getMetric('Supportability/Transaction/Count');
            expect(metric, 'is defined').not.equal(undefined);
            expect(metric.stats.callCount, 'has been incremented').equal(1);

            return done();
          });

          var transaction = debugged.createTransaction();
          transaction.end();
        });
      });
    });

    describe("when dealing with its event handlers", function () {
      describe("when setting up event subscriptions", function () {
        it("should have one handler defined on the 'change' event on the agent's configuration", function () {
          agent.config.listeners('change').length.should.equal(1);
        });

        it("should have two handlers defined on the 'connect' event on the agent", function () {
          connection.listeners('connect').length.should.equal(2);
        });

        it("should have one handler defined on the 'metricDataError' event on the agent", function () {
          connection.listeners('metricDataError').length.should.equal(1);
        });

        it("should have one handler defined on the 'metricDataResponse' event on the agent", function () {
          connection.listeners('metricDataResponse').length.should.equal(1);
        });

        it("should have one handler defined on the 'errorDataError' event on the agent", function () {
          connection.listeners('errorDataError').length.should.equal(1);
        });

        it("should have one handler defined on the 'connectError' event on the agent", function () {
          connection.listeners('connectError').length.should.equal(1);
        });
      });

      describe("when handling events", function () {
        it("should update the metrics' apdex tolerating value when configuration changes", function (done) {
          expect(agent.metrics.apdexT).equal(0);
          process.nextTick(function () {
            should.exist(agent.metrics.apdexT);
            agent.metrics.apdexT.should.equal(0.666);

            return done();
          });

          agent.config.emit('change', {'apdex_t' : 0.666});
        });

        it("should reset the configuration and metrics normalizer when the agent connects", function (done) {
          should.not.exist(agent.config.apdex_t);
          process.nextTick(function () {
            expect(agent.config.apdex_t).equal(0.742);
            expect(agent.metrics.apdexT).equal(0.742);
            expect(agent.metrics.normalizer.rules).deep.equal([]);

            return done();
          });

          connection.emit('connect', {apdex_t : 0.742, url_rules : []});
        });

        it("should parse metrics responses when metric data is received", function (done) {
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

          connection.emit('metricDataResponse', [[{name : NAME, scope : SCOPE}, METRICID]]);
        });

        it("should capture the trace off a finished transaction", function (done) {
          var trans = agent.createTransaction();
          // need to initialize the trace
          var trace = trans.getTrace();
          trans.measureWeb('/ham/update/3', 200, 304);

          agent.once('transactionFinished', function () {
            expect(agent.traces.trace, "trace should be captured").not.equal(undefined);
            expect(agent.traces.trace.getDurationInMillis(), "same trace just passed in").equal(304);

            return done();
          });

          trans.end();
        });
      });
    });

    it("should have three handlers defined on the transactionFinished event", function () {
      // one to merge metrics
      // one to update error counts
      // one to pass finished traces to the slow trace aggregator
      agent.listeners('transactionFinished').length.should.equal(3);
    });
  });
});
