'use strict';

var path                = require('path')
  , chai                = require('chai')
  , expect              = chai.expect
  , should              = chai.should()
  , sinon               = require('sinon')
  , logger              = require(path.join(__dirname, '..', 'lib',
                                            'logger')).child({component : 'TEST'})
  , configurator        = require(path.join(__dirname, '..', 'lib', 'config'))
  , Agent               = require(path.join(__dirname, '..', 'lib', 'agent'))
  , CollectorConnection = require(path.join(__dirname, '..', 'lib',
                                            'collector', 'connection'))
  , DataSender          = require(path.join(__dirname, '..', 'lib',
                                            'collector', 'data-sender'))
  , ErrorTracer         = require(path.join(__dirname, '..', 'lib', 'error'))
  , Metrics             = require(path.join(__dirname, '..', 'lib', 'metrics'))
  , SQLTrace            = require(path.join(__dirname, '..', 'lib',
                                            'transaction', 'trace', 'sql'))
  , Stats               = require(path.join(__dirname, '..', 'lib', 'stats'))
  , Transaction         = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

function generateSubmissionURL(protocolVersion, key, method, runId) {
  return '/agent_listener/invoke_raw_method' +
    '?marshal_format=json' +
    '&protocol_version=' + protocolVersion +
    '&license_key=' + key +
    '&method=' + method +
    '&run_id=' + runId;
}

describe("CollectorConnection", function () {
  // CONSTANTS
  var SAMPLE_RUN_ID = 101010101
    , PROTOCOL_VERSION = 12
    ;

  var agent
    , testLicense   = 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b'
    , collectorHost = 'staging-collector.newrelic.com'
    , config        = configurator.initialize(logger, {
        'config' : {
          'app_name'    : 'node.js Tests',
          'license_key' : testLicense,
          'host'        : collectorHost,
          'port'        : 80
        }
      })
    ;

  it("starts out disconnected", function () {
    expect(new CollectorConnection(new Agent(config)).isConnected()).equal(false);
  });

  describe("with a mocked DataSender", function () {
    var connection
      , method
      , uri
      , params
      ;

    beforeEach(function () {
      agent = new Agent(configurator.initialize(logger, {
        'config' : {
          'app_name'    : 'node.js Tests',
          'license_key' : testLicense,
          'host'        : collectorHost,
          'port'        : 80,
          // run_id is set as a side effect of the connect() method.
          'run_id'      : SAMPLE_RUN_ID
        }
      }));
      connection = new CollectorConnection(agent);

      // DataSender is created entirely within send(), so mock indirectly
      sinon.stub(DataSender.prototype, 'invokeMethod', function (sMethod, sData) {
        method = sMethod;
        uri    = this.getURL(method);
        params = sData;
      });
    });

    afterEach(function () {
      DataSender.prototype.invokeMethod.restore();
    });

    // https://hudson.newrelic.com/job/collector-master/javadoc/com/nr/collector/methods/MetricDataMethod.html
    describe("sending metric data", function () {
      var metrics;

      beforeEach(function () {
        // let's try a ludicrously high Apdex T
        metrics = new Metrics(1, agent.mapper, agent.metricNameNormalizer);
        metrics.started = 12000;
        metrics.measureMilliseconds('Test/SampleMetric/all', null, 3, 1);

        connection.sendMetricData(metrics);
      });

      it("blows up if invoked without metrics", function () {
        expect(function () { connection.sendMetricData(null); }).throws();
      });

      it("invokes metric_data", function () {
        expect(method).equal('metric_data');
      });

      it("generates the correct URL", function () {
        expect(uri).equal(generateSubmissionURL(PROTOCOL_VERSION, testLicense,
                                                'metric_data', SAMPLE_RUN_ID));
      });

      it("puts the run ID in the right place", function () {
        var runId = params[0] ;
        expect(runId).equal(SAMPLE_RUN_ID);
      });

      it("puts the harvest cycle start time in the right place", function () {
        var startTime = params[1];
        expect(startTime).equal(12);
      });

      it("puts the harvest cycle end time in the right place", function () {
        var endTime = params[2];
        expect(endTime).not.above(Date.now() / 1000);
      });

      it("passes along the metrics unmolested", function () {
        var metricData = params[3];
        expect(metricData).deep.equal(metrics);
      });
    });

    // https://hudson.newrelic.com/job/collector-master/javadoc/com/nr/collector/methods/ErrorData.html
    describe("sending error traces", function () {
      var data;

      beforeEach(function () {
        var errors = new ErrorTracer(config);

        var transaction = new Transaction(agent);
        transaction.url = '/test-request/churro';
        transaction.name = 'WebTransaction/StatusCode/400';
        transaction.statusCode = 400;
        transaction.end();

        errors.onTransactionFinished(transaction, agent.metrics);
        data = errors.errors;
        connection.sendTracedErrors(errors.errors);
      });

      it("blows up if invoked without errors", function () {
        expect(function () { connection.sendTracedErrors(null); }).throws();
      });

      it("invokes error_data", function () {
        expect(method).equal('error_data');
      });

      it("generates the correct URL", function () {
        expect(uri).equal(generateSubmissionURL(PROTOCOL_VERSION, testLicense,
                                                'error_data', SAMPLE_RUN_ID));
      });

      it("puts the run ID in the correct place", function () {
        var runId = params[0];
        expect(runId).equal(SAMPLE_RUN_ID);
      });

      it("shouldn't mess with the error trace(s)", function () {
        var errorData = params[1];
        // 0: ignored
        // 1: name
        // 2: message
        // 3: error type
        // 4: params
        expect(errorData).deep.equal(
          [
            [
              0,
              'WebTransaction/StatusCode/400',
              'HttpError 400',
              'Error',
              {request_uri : '/test-request/churro'}
            ]
          ]
        );
      });
    });

    // https://pdx-hudson.datanerd.us/job/collector-master/javadoc/com/nr/collector/methods/TransactionSampleData.html
    describe("sending transaction traces", function () {
      var traces;

      beforeEach(function () {
        var transaction = new Transaction(agent)
          , parent      = transaction.getTrace().add('Express/Uri/test-get')
          , child       = parent.add('MongoDB/insert/user')
          ;

        child.end();
        parent.end();
        transaction.getTrace().end();
        transaction.end();

        traces = [transaction.getTrace()];

        connection.sendTransactionTraces(traces);
      });

      it("blows up if invoked without a trace", function () {
        expect(function () { connection.sendTransactionTraces(null); }).throws();
      });

      it("invokes transaction_sample_data", function () {
        expect(method).equal('transaction_sample_data');
      });

      it("generates the correct URL", function () {
        expect(uri).equal(generateSubmissionURL(PROTOCOL_VERSION,
                                                testLicense,
                                                'transaction_sample_data',
                                                SAMPLE_RUN_ID));
      });

      it("leaves the trace data alone", function () {
        var traceData = params[1];
        expect(traceData).deep.equal(traces);
      });
    });

    // https://hudson.newrelic.com/job/collector-master/javadoc/com/nr/collector/methods/SqlTraceData.html
    describe("sending SQL traces", function () {
      var sqls;

      beforeEach(function (done) {
        sqls = [];

        var transaction = new Transaction(agent);
        transaction.url = '/bros/steak';
        transaction.name = 'WebTransaction/Uri/bros/steak';
        transaction.statusCode = 200;
        transaction.end();

        var trace = new SQLTrace('SELECT dude FROM bro WHERE meat = :ham',
                                 transaction,
                                 new Stats());

        trace.generateJSON('DB/BroSQL/dudefella', {ham : 'steak'}, function (err, json) {
          if (err) return done(err);

          sqls.push(json);
          connection.sendSQLTraces(sqls);

          done();
        });
      });

      it("blows up if invoked without slow SQL", function () {
        expect(function () { connection.sendSQLTraces(null); }).throws();
      });

      it("invokes sql_trace_data", function () {
        expect(method).equal('sql_trace_data');
      });

      it("generates the correct URL", function () {
        expect(uri).equal(generateSubmissionURL(PROTOCOL_VERSION,
                                                testLicense,
                                                'sql_trace_data',
                                                SAMPLE_RUN_ID));
      });

      it("shouldn't mess up the traces", function () {
        var sqlTraces = params;
        expect(sqlTraces).deep.equal(sqls);
      });
    });

    // https://hudson.newrelic.com/job/collector-master/javadoc/com/nr/collector/methods/Shutdown.html
    describe("shutting down", function () {
      beforeEach(function () {
        connection.sendShutdown();
      });

      it("invokes shutdown", function () {
        expect(method).equal('shutdown');
      });

      it("generates the correct URL", function () {
        expect(uri).equal(generateSubmissionURL(PROTOCOL_VERSION, testLicense,
                                                'shutdown', SAMPLE_RUN_ID));
      });

      it("includes no parameters", function () {
        should.not.exist(params);
      });
    });
  });

  describe("when sent a ForceRestartException by the collector", function () {
    it("restarts the agent", function (done) {
      var invokeMethod = DataSender.prototype.invokeMethod;

      agent.once('restart', function () {
        // if this event is received, mission accomplished
        DataSender.prototype.invokeMethod = invokeMethod;
        return done();
      });

      var emitted = false;
      // don't need to actually talk to the connector
      DataSender.prototype.invokeMethod = function () {
        // don't keep emitting errors or else sendShutdown will trigger an infinite
        // recursion.
        if (!emitted) {
          emitted = true;
          this.emit('error', 'metric_data', {
            error_type : "NewRelic::Agent::ForceRestartException",
            message    : "RPM has detected that this agent has stale configuration. " +
                         "Launch time=2012-12-07 22:20:37 " +
                         "Config time=2012-12-07 22:21:55 " +
                         "Forcing restart."
          });
        }
      };

      var connection      = new CollectorConnection(agent);
      agent.connection    = connection;
      agent.config.run_id = SAMPLE_RUN_ID;
      agent.metrics.measureMilliseconds('Test/Unimportant', 23);

      connection.sendMetricData(agent.metrics);
    });
  });

  describe("when sent a ForceDisconnectException by the collector", function () {
    it("shuts the agent down", function (done) {
      var invokeMethod = DataSender.prototype.invokeMethod;

      agent.once('shutdown', function () {
        // if this event is received, mission accomplished
        DataSender.prototype.invokeMethod = invokeMethod;

        should.not.exist(agent.connection);
        return done();
      });

      var emitted = false;
      // don't need to actually talk to the connector
      DataSender.prototype.invokeMethod = function () {
        // don't keep emitting errors or else sendShutdown will trigger an infinite
        // recursion.
        if (!emitted) {
          emitted = true;
          this.emit('error', 'metric_data', {
            error_type : "NewRelic::Agent::ForceDisconnectException",
            message    : "Test disconnection message."
          });
        }
      };

      var connection        = new CollectorConnection(agent);
      agent.connection      = connection;
      agent.config.run_id = SAMPLE_RUN_ID;
      agent.metrics.measureMilliseconds('Test/Unimportant', 23);

      connection.sendMetricData(agent.metrics);
    });
  });
});
