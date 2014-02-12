'use strict';

var path         = require('path')
  , test         = require('tap').test
  , nock         = require('nock')
  , configurator = require(path.join(__dirname, '..', '..', 'lib', 'config.js'))
  , Agent        = require(path.join(__dirname, '..', '..', 'lib', 'agent.js'))
  , Transaction  = require(path.join(__dirname, '..', '..', 'lib', 'transaction.js'))
  ;

nock.disableNetConnect();

test("harvesting with a mocked collector that returns 413 after connect", function (t) {
  var RUN_ID      = 1337
    , url         = 'https://collector.newrelic.com'
    , agent       = new Agent(configurator.initialize())
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

  var sendMetrics = nock(url).post(path('metric_data', RUN_ID)).reply(413)
    , sendErrors  = nock(url).post(path('error_data', RUN_ID)).reply(413)
    , sendTrace   = nock(url).post(path('transaction_sample_data', RUN_ID)).reply(413)
    ;

  var sendShutdown = nock(url).post(path('shutdown', RUN_ID)).reply(200);

  agent.start(function (error, config) {
    t.notOk(error, 'got no error on connection');
    t.deepEqual(config, {agent_run_id : RUN_ID}, 'got configuration');
    t.ok(redirect.isDone(),    "requested redirect");
    t.ok(handshake.isDone(),   "got handshake");

    // need sample data to give the harvest cycle something to send
    agent.errors.add(transaction, new Error('test error'));
    agent.traces.trace = transaction.getTrace();

    agent.harvest(function (error) {
      t.notOk(error, "no error received on 413");
      t.ok(sendMetrics.isDone(), "sent metrics...");
      t.ok(sendErrors.isDone(),  "...and then sent error data...");
      t.ok(sendTrace.isDone(),   "...and then sent trace, even though all returned 413");

      agent.stop(function () {
        t.ok(sendShutdown.isDone(), "got shutdown message");
        t.end();
      });
    });
  });
});

test("discarding metrics and errors after a 413", function (t) {
  t.plan(3);

  var RUN_ID      = 1338
    , url         = 'https://collector.newrelic.com'
    , agent       = new Agent(configurator.initialize())
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

  nock(url).post(path('metric_data', RUN_ID)).reply(413);
  nock(url).post(path('error_data', RUN_ID)).reply(413);
  nock(url).post(path('transaction_sample_data', RUN_ID)).reply(413);

  nock(url).post(path('shutdown', RUN_ID)).reply(200);

  agent.start(function () {
    // need sample data to give the harvest cycle something to send
    agent.errors.add(transaction, new Error('test error'));
    agent.traces.trace = transaction.getTrace();

    agent.harvest(function (error) {
      t.notOk(error, "shouldn't have gotten back error for 413");
      t.equal(agent.errors.errors.length, 0, "errors were discarded");
      t.deepEqual(agent.metrics.toJSON(), [], "metrics were discarded");

      agent.stop(function () {});
    });
  });
});
