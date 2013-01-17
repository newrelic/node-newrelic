'use strict';

var path         = require('path')
  , tap          = require('tap')
  , test         = tap.test
  , logger       = require(path.join(__dirname, '..', '..', 'lib', 'logger')).child({component : 'TEST'})
  , configurator = require(path.join(__dirname, '..', '..', 'lib', 'config'))
  , Agent        = require(path.join(__dirname, '..', '..', 'lib', 'agent'))
  ;

test("CollectorConnection should connect to staging-collector.newrelic.com",
     {timeout : 5 * 1000},
     function (t) {
  var config = configurator.initialize(logger, {
        'config' : {
          'app_name'    : 'node.js Tests',
          'license_key' : 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b',
          'host'        : 'staging-collector.newrelic.com',
          'port'        : 80
        }
      })
    , agent = new Agent({config : config})
    ;

  agent.on('connect', function () {
    var connection = agent.connection
      , config     = agent.config
      , connectResponseCalled
      , handshakeResponseCalled
      , configUpdated
      , connected
      , ended
      , shutDown
      , closed
      ;

    t.ok(connection, "agent connection initialized");
    t.ok(agent.id, "agent's ID is known");

    connection.on('connectResponse', function (host) {
      t.ok(host, "got a redirect host");
      t.notOk(connectResponseCalled, "connectResponse fired, but only once");
      connectResponseCalled = true;
    });

    connection.on('handshakeResponse', function (response) {
      t.ok(connectResponseCalled, "already got redirect host at handshake time");
      t.ok(response, "got a response hash from the server");
      t.notOk(handshakeResponseCalled, "handshakeResponse fired, but only once");
      handshakeResponseCalled = true;
    });

    config.on('change', function (changed) {
      t.ok(connectResponseCalled, "already got redirect host at config time");
      t.ok(handshakeResponseCalled, "already performed handshake at config time");
      t.ok(changed, "configuration is present");
      t.notOk(configUpdated, "configuration updated, but only once");
      configUpdated = true;
    });

    connection.on('end', function () {
      t.ok(connectResponseCalled, "already got redirect host at connection end time");
      t.ok(handshakeResponseCalled, "already performed handshake at connection end time");
      t.ok(connected, "already connected at connection end time");
      t.notOk(ended, "connection ended, but only once");
      ended = true;
    });

    connection.on('shutdown', function () {
      t.ok(connectResponseCalled, "already got redirect host at shutdown time");
      t.ok(handshakeResponseCalled, "already performed handshake at shutdown time");
      t.ok(connected, "already connected at shutdown time");
      t.ok(ended, "already ended at shutdown time");
      t.notOk(shutDown, "shutdown happened, but only once");
      shutDown = true;
    });

    connection.on('close', function () {
      t.ok(connectResponseCalled, "already got redirect host at close time");
      t.ok(handshakeResponseCalled, "already performed handshake at close time");
      t.ok(connected, "already connected at close time");
      t.ok(ended, "already ended at close time");
      t.ok(shutDown, "shutdown happened at close time");
      t.notOk(connection.agentRunId, "agent run ID is cleared after close");
      t.notOk(closed, "connection closed only once");
      closed = true;

      t.end();
    });

    connection.on('connect', function (response) {
      t.ok(connectResponseCalled, "already got redirect host when connected");
      t.ok(handshakeResponseCalled, "already fetched agent configuration when connected");
      t.ok(configUpdated, "configuration updated at connect time");
      t.ok(response, "agent configuration made it through to the connect event");
      t.ok(connection.agentRunId, "agent run ID is set after connect");

      connected = true;
      agent.stop();
    });
  });

  /*
   * Immediately set the applicationPort (don't do this in production code)
   * to get the connect handler to fire immediately, instead of waiting for
   * 15 seconds.
   */
  agent.applicationPort = 6666;
  agent.start();
});
