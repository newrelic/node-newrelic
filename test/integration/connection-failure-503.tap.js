'use strict';

var path         = require('path')
  , test         = require('tap').test
  , nock         = require('nock')
  , dns          = require ('dns')
  , logger       = require(path.join(__dirname, '..', '..', 'lib', 'logger'))
                     .child({component : 'TEST'})
  , configurator = require(path.join(__dirname, '..', '..', 'lib', 'config.js'))
  , Agent        = require(path.join(__dirname, '..', '..', 'lib', 'agent.js'))
  , Transaction  = require(path.join(__dirname, '..', '..', 'lib', 'transaction.js'))
  ;

test("harvesting with a mocked collector that returns 503 after connect", function (t) {
  nock.disableNetConnect();

  dns.lookup('collector.newrelic.com', function (error, collector) {
    if (error) {
      t.fail(error);
      return t.end();
    }

    var RUN_ID      = 1337
      , url         = 'http://' + collector
      , agent       = new Agent(configurator.initialize(logger))
      , transaction = new Transaction(agent)
      ;

    function path(method, runID) {
      var fragment = '/agent_listener/invoke_raw_method?' +
        'marshal_format=json&protocol_version=12&' +
        'license_key=license%20key%20here&method=' + method;

      if (runID) fragment += '&run_id=' + runID;

      return fragment;
    }

    var redirect = nock(url).post(path('get_redirect_host'))
                     .reply(200, {return_value : "collector.newrelic.com"});

    var handshake = nock(url).post(path('connect'))
                      .reply(200, {return_value : {agent_run_id : RUN_ID}});

    var sendMetrics = nock(url).post(path('metric_data', RUN_ID)).reply(503)
      , sendErrors  = nock(url).post(path('error_data', RUN_ID)).reply(503)
      , sendTrace   = nock(url).post(path('transaction_sample_data', RUN_ID)).reply(503)
      , shutdown    = nock(url).post(path('shutdown', RUN_ID)).reply(503)
      ;

    // needed to create the connection
    agent.start();

    agent.connection.on('connect', function () {
      // disable the default harvester
      clearInterval(agent.harvesterHandle);

      agent.connection.on('transactionSampleDataError', function () {
        t.ok(redirect.isDone(),    "requested redirect");
        t.ok(handshake.isDone(),   "got handshake");
        t.ok(sendMetrics.isDone(), "tried to send metrics");
        t.ok(sendErrors.isDone(),  "tried to send errors");
        t.ok(sendTrace.isDone(),   "tried to send transaction trace");

        agent.connection.on('shutdownError', function () {
          t.ok(shutdown.isDone(), "tried to send shutdown");

          t.end();
        });

        agent.stop();
      });

      // need sample data to give the harvest cycle something to send
      agent.errors.add(transaction, new Error('test error'));
      agent.traces.trace = transaction.getTrace();

      agent.harvest();
    });
  });
});

test("merging metrics and errors after a 503", function (t) {
  t.plan(6);

  nock.disableNetConnect();

  dns.lookup('collector.newrelic.com', function (error, collector) {
    if (error) {
      t.fail(error);
      return t.end();
    }

    var RUN_ID      = 1338
      , url         = 'http://' + collector
      , agent       = new Agent(configurator.initialize(logger))
      , transaction = new Transaction(agent)
      ;

    function path(method, runID) {
      var fragment = '/agent_listener/invoke_raw_method?' +
        'marshal_format=json&protocol_version=12&' +
        'license_key=license%20key%20here&method=' + method;

      if (runID) fragment += '&run_id=' + runID;

      return fragment;
    }

    nock(url).post(path('get_redirect_host'))
             .reply(200, {return_value : "collector.newrelic.com"});

    nock(url).post(path('connect'))
             .reply(200, {return_value : {agent_run_id : RUN_ID}});

    nock(url).post(path('metric_data', RUN_ID)).reply(503);
    nock(url).post(path('error_data', RUN_ID)).reply(503);
    nock(url).post(path('transaction_sample_data', RUN_ID)).reply(503);

    var shutdown = nock(url).post(path('shutdown', RUN_ID)).reply(503);

    // needed to create the connection
    agent.start();

    agent.connection.on('connect', function () {
      // disable the default harvester
      clearInterval(agent.harvesterHandle);

      agent.connection.on('errorDataError', function () {
        process.nextTick(function () {
          t.equal(agent.errors.errors.length, 1, "errors were merged back in");
          var merged = agent.errors.errors[0];
          t.deepEqual(merged[0], 0, "found timestamp in merged error");
          t.deepEqual(merged[1], 'WebTransaction/Uri/*', "found scope in merged error");
          t.deepEqual(merged[2], 'test error', "found message in merged error");
        });
      });

      agent.connection.on('metricDataError', function () {
        process.nextTick(function () {
          t.deepEqual(
            agent.metrics.toJSON(),
            [[
              {name : "Errors/all"},
              {
                total          : 0,
                totalExclusive : 0,
                min            : 0,
                max            : 0,
                sumOfSquares   : 0,
                callCount      : 1
              }
            ]],
            'metrics were merged');
        });
      });

      agent.connection.on('transactionSampleDataError', function () {
        agent.connection.on('shutdownError', function () {
          t.ok(shutdown.isDone(), "tried to send shutdown");
        });

        agent.stop();
      });

      // need sample data to give the harvest cycle something to send
      agent.errors.add(transaction, new Error('test error'));
      agent.traces.trace = transaction.getTrace();

      agent.harvest();
    });
  });
});
