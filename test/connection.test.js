'use strict';

var path                = require('path')
  , chai                = require('chai')
  , expect              = chai.expect
  , sinon               = require('sinon')
  , logger              = require(path.join(__dirname, '..', 'lib', 'logger')).child({component : 'TEST'})
  , config              = require(path.join(__dirname, '..', 'lib', 'config'))
  , Agent               = require(path.join(__dirname, '..', 'lib', 'agent'))
  , CollectorConnection = require(path.join(__dirname, '..', 'lib', 'collector', 'connection'))
  , DataSender          = require(path.join(__dirname, '..', 'lib', 'collector', 'data-sender'))
  , ErrorTracer         = require(path.join(__dirname, '..', 'lib', 'error'))
  , Metrics             = require(path.join(__dirname, '..', 'lib', 'metrics'))
  , SQLTrace            = require(path.join(__dirname, '..', 'lib', 'transaction', 'trace', 'sql'))
  , Stats               = require(path.join(__dirname, '..', 'lib', 'stats'))
  , Transaction         = require(path.join(__dirname, '..', 'lib', 'transaction'))
  ;

function generateSubmissionURL(protocolVersion, key, method, runId) {
  return '/agent_listener/invoke_raw_method' +
    '?marshal_format=json' +
    '&protocol_version=' + protocolVersion +
    '&license_key=' + key +
    '&method=' + method +
    '&agent_run_id=' + runId;
}

describe("CollectorConnection", function () {
  var agent
    , testLicense   = 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b'
    , collectorHost = 'staging-collector.newrelic.com'
    ;

  describe("with a mocked DataSender", function () {
    var SAMPLE_RUN_ID = 101010101
      , PROTOCOL_VERSION = 9
      ;

    var connection
      , mockConnection
      , method
      , uri
      , params
      ;

    beforeEach(function () {
      agent = new Agent();
      agent.config = config.initialize(logger, {
        'config' : {
          'app_name'    : 'node.js Tests',
          'license_key' : testLicense,
          'host'        : collectorHost,
          'port'        : 80
        }
      });
      connection = new CollectorConnection(agent);
      // agentRunId is set as a side effect of the connect() method.
      connection.agentRunId = SAMPLE_RUN_ID;
      mockConnection = sinon.mock(connection);

      // replace CollectorConnection.createDataSender
      var sender = new DataSender(agent.config, SAMPLE_RUN_ID);
      // stub out DataSender.send
      sender.send = function (sMethod, sUri, sParams) {
        method   = sMethod;
        uri      = sUri;
        params   = sParams;
      };

      // replace CollectorConnection.createDataSender
      mockConnection.expects('createDataSender').once().returns(sender);
    });

    // https://hudson.newrelic.com/job/collector-master/javadoc/com/nr/collector/methods/MetricDataMethod.html
    it("should send metric data in the expected format", function () {
      // let's try a ludicrously high Apdex T
      var metrics = new Metrics(1);
      metrics.measureDurationUnscoped('Test/SampleMetric/all', 3, 1);

      connection.sendMetricData(12, 1014, metrics.toJSON());
      mockConnection.verify();

      expect(method).equal('metric_data');
      expect(uri).equal(generateSubmissionURL(PROTOCOL_VERSION, testLicense,
                                              'metric_data', SAMPLE_RUN_ID));
      var runId      = params[0]
        , startTime  = params[1]
        , endTime    = params[2]
        , metricData = params[3]
        ;
      expect(runId).equal(SAMPLE_RUN_ID);
      expect(startTime).equal(12);
      expect(endTime).equal(1014);
      expect(metricData).deep.equal(metrics.toJSON());
    });

    // https://hudson.newrelic.com/job/collector-master/javadoc/com/nr/collector/methods/ErrorData.html
    it("should send traced errors in the expected format", function () {
      var errors = new ErrorTracer(agent.config);

      var transaction = new Transaction(agent);
      transaction.measureWeb('/test-request/churro', 400, 5, 5);

      errors.onTransactionFinished(transaction);
      connection.sendTracedErrors(errors.errors);
      mockConnection.verify();

      expect(method).equal('error_data');
      expect(uri).equal(generateSubmissionURL(PROTOCOL_VERSION, testLicense,
                                              'error_data', SAMPLE_RUN_ID));
      var runId     = params[0]
        , errorData = params[1]
        ;
      expect(runId).equal(SAMPLE_RUN_ID);
      // 0: ignored
      // 1: scope
      // 2: message
      // 3: message class
      // 4: params
      expect(errorData).deep.equal([
                                     [
                                       0,
                                       'WebTransaction/StatusCode/400',
                                       'HttpError 400',
                                       'HttpError 400',
                                       {request_uri : '/test-request/churro'}
                                     ]
                                   ]);
    });

    // https://hudson.newrelic.com/job/collector-master/javadoc/com/nr/collector/methods/TransactionSampleData.html
    it("should send transaction traces in the expected format", function () {
      var transaction = new Transaction(agent);
      var parent = transaction.getTrace().add('Express/Uri/test-get');
      var child = parent.add('MongoDB/insert/user');
      child.end();
      parent.end();
      transaction.getTrace().end();

      var traces = [transaction.getTrace()];

      connection.sendTransactionTraces(traces);
      mockConnection.verify();

      expect(method).equal('transaction_sample_data');
      expect(uri).equal(generateSubmissionURL(PROTOCOL_VERSION, testLicense,
                                              'transaction_sample_data', SAMPLE_RUN_ID));
      var runId     = params[0]
        , traceData = params[1]
        ;
      expect(traceData).deep.equal(traces);
    });

    // https://hudson.newrelic.com/job/collector-master/javadoc/com/nr/collector/methods/SqlTraceData.html
    it("should send SQL trace data in the expected format", function (done) {
      var sqls = [];

      var transaction = new Transaction(agent);
      transaction.measureWeb('/bros/steak', 200, 487, 28);

      var trace = new SQLTrace('SELECT dude FROM bro WHERE meat = :ham',
                               transaction,
                               new Stats());
      trace.generateJSON('DB/BroSQL/dudefella', {ham : 'steak'}, function (err, json) {
        if (err) return done(err);

        sqls.push(json);

        connection.sendSQLTraces(sqls);
        mockConnection.verify();

        expect(method).equal('sql_trace_data');
        expect(uri).equal(generateSubmissionURL(PROTOCOL_VERSION, testLicense,
                                                'sql_trace_data', SAMPLE_RUN_ID));
        var sqlTraces = params;
        expect(sqlTraces).deep.equal(sqls);

        return done();
      });
    });
  });
});
