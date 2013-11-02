'use strict';

var path         = require('path')
  , test         = require('tap').test
  , sinon        = require('sinon')
  , logger       = require(path.join(__dirname, '..', '..', 'lib', 'logger'))
                     .child({component : 'TEST'})
  , configurator = require(path.join(__dirname, '..', '..', 'lib', 'config.js'))
  , Agent        = require(path.join(__dirname, '..', '..', 'lib', 'agent.js'))
  ;

test("connecting when the collector is unavailable", function (t) {
  t.plan(7);

  /*
   * THIS TEST USES TIME TRAVEL
   *
   * That's why it's on its own in an integration test.
   */
  var clock = sinon.useFakeTimers();

  var agent = new Agent(configurator.initialize(logger));
  agent.config.host = 'localhost';
  agent.config.port = 8765;

  agent._nextConnectAttempt = function (backoff) {
    t.ok(backoff, "got the backoff information");
    t.equal(backoff.warn,  false, "first retry doesn't warn");
    t.equal(backoff.error, false, "first retry doesn't error");
    t.equal(backoff.interval, 15, "first retry is after 15 seconds");

    agent.stop();
    clock.restore();
  };

  // needed to create the connection
  agent.start();

  agent.connection.once('connectError', function (data, error) {
    t.equal(agent.connectionFailures, 1, "got a failure");
    t.notOk(data, "no actual data sent with message");
    t.equal(error.message, 'connect ECONNREFUSED', "got expected error");

    clock.tick(15001);
  });
});
