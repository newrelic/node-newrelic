'use strict'

var tap = require('tap')


tap.test('loading the agent with a bad version', {timeout: 20000}, function(t) {
  var agent = null

  process.env.NEW_RELIC_HOME = __dirname + '/..'
  process.env.NEW_RELIC_HOST = 'staging-collector.newrelic.com'
  process.env.NEW_RELIC_LICENSE_KEY = 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b'

  t.doesNotThrow(function() {
    var _version = process.version
    Object.defineProperty(process, 'version', {value: 'garbage', writable: true})
    t.equal(process.version, 'garbage', 'should have set bad version')

    var api = require('../../../index.js')
    agent = api.agent
    t.ok(agent)

    process.version = _version
  }, "malformed process.version doesn't blow up the process")
  if (!t.passing()) {
    t.comment('Bailing out early.')
    return t.end()
  }

  function shutdown() {
    t.equal(agent._state, 'started', "agent didn't error connecting to staging")
    t.deepEquals(agent.config.applications(), ['My Application'], "app name is valid")
    t.equals(agent.config.agent_enabled, true, "the agent is still enabled")

    agent.stop(function cb_stop(err) {
      t.notOk(err, 'should not error when stopping')
      t.equal(agent._state, 'stopped', "agent didn't error shutting down")

      t.end()
    })
  }

  agent.once('errored', shutdown)
  agent.once('started', shutdown)
})
