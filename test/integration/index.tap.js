'use strict'

var path = require('path')
  , test = require('tap').test
  

test("loading the application via index.js", function (t) {
  t.plan(6)

  var agent

  // just in case connection fails
  global.setTimeout = process.nextTick

  process.env.NEW_RELIC_HOST = 'staging-collector.newrelic.com'
  process.env.NEW_RELIC_LICENSE_KEY = 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b'

  t.doesNotThrow(function cb_doesNotThrow() {
    var api = require('../../index.js')
    agent = api.agent
    t.equal(agent._state, 'starting', "agent is booting")
  }, "just loading the agent doesn't throw")

  function shutdown() {
    t.equal(agent._state, 'started', "agent didn't error connecting to staging")
    t.deepEquals(agent.config.applications(), ['My Application'], "app name is valid")
    t.equals(agent.config.agent_enabled, true, "the agent is still enabled")
    agent.stop(function cb_stop() {
      t.equal(agent._state, 'stopped', "agent didn't error shutting down")
    })
  }

  agent.once('errored', shutdown)
  agent.once('started', shutdown)
});