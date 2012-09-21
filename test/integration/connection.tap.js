'use strict';

var path         = require('path')
  , tap          = require('tap')
  , test         = tap.test
  , logger       = require(path.join(__dirname, '..', '..', 'lib', 'logger'))
  , configurator = require(path.join(__dirname, '..', '..', 'lib', 'config'))
  , Agent        = require(path.join(__dirname, '..', '..', 'lib', 'agent'))
  ;

test("CollectorConnection should connect to staging-collector.newrelic.com",
     {timeout : 5 * 1000},
     function (t) {
  t.plan(3);

  var testLicense   = 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b'
    , collectorHost = 'staging-collector.newrelic.com'
    ;

  var config = configurator.initialize(logger, {
    'config' : {
      'app_name'    : 'node.js Tests',
      'license_key' : testLicense,
      'host'        : collectorHost,
      'port'        : 80
    }
  });

  var agent = new Agent({config : config});

  /*
   * Immediately set the applicationPort (don't do this in production code)
   * to get the connect handler to fire immediately, instead of waiting for
   * 15 seconds.
   */
  agent.applicationPort = 6666;

  agent.on('connect', function () {
    t.ok(agent.connection, "agent connection initialized");
    t.deepEquals(agent.connection.applicationName, ['node.js Tests'], "application name is set");

    agent.connection.on('connect', function () {
      t.ok(agent.connection.agentRunId, "agent run ID is set after connect");
      agent.stop();

      t.end();
    });
  });

  agent.start();
});
