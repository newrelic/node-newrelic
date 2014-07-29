'use strict';

var path = require('path')
  , test = require('tap').test
  ;

var APP_NAME_REGEX = /^[A-Za-z0-9 -_\[\](){}?!.'"]*$/;

test("loading the application via index.js for an invalid app_name", function (t) {
  t.plan(4);

  var agent
    , appName
    ;

  // just in case connection fails
  global.setTimeout = process.nextTick;

  process.env.NEW_RELIC_HOME = path.join(__dirname, 'configs')
  process.env.NEW_RELIC_HOST = 'staging-collector.newrelic.com';
  process.env.NEW_RELIC_LICENSE_KEY = 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b';

  t.doesNotThrow(function cb_doesThrow() {
    var api = require(path.join(__dirname, '..', '..', 'index.js'));
    agent = api.agent;
    appName = agent.config.applications()[0];
    t.equal(agent._state, 'stopped', "agent is not booting");
    t.equals(agent.config.agent_enabled, false, "the agent is not enabled")
    t.equals(appName.match(APP_NAME_REGEX), null, "app name is invalid");
  }, "just loading the agent doesn't throw");



});