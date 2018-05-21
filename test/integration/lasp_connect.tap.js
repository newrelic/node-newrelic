'use strict'

var tap = require('tap')
var configurator = require('../../lib/config')
var Agent = require('../../lib/agent')
var CollectorAPI = require('../../lib/collector/api')

tap.test('connecting with a LASP token should not error', function(t) {
  var config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: '1cccc807e3eb81266a3f30d9a58cfbbe9d613049',
    security_policies_token: 'ffff-ffff-ffff-ffff',
    host: 'staging-collector.newrelic.com',
    utilization: {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: false
    },
    logging: {
      level: 'trace'
    }
  })
  var agent = new Agent(config)
  var api = new CollectorAPI(agent)

  api.connect(function(error, returned) {
    t.notOk(error, 'connected without error')
    t.ok(returned, 'got boot configuration')
    t.ok(returned.agent_run_id, 'got run ID')
    t.ok(agent.config.run_id, 'run ID set in configuration')

    api.shutdown(function(error, returned, json) {
      t.notOk(error, 'should have shut down without issue')
      t.equal(returned, null, 'collector explicitly returns null')
      t.deepEqual(json, {return_value: null}, 'raw message looks right')
      t.notOk(agent.config.run_id, 'run ID should have been cleared by shutdown')
      t.end()
    })
  })
})

tap.test('missing required policies should error', function(t) {
  var config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: '20a5bbc045930ae7e15b530c8a9c6b7c5a918c4f',
    security_policies_token: 'ffff-ffff-ffff-ffff',
    host: 'staging-collector.newrelic.com',
    utilization: {
      detect_aws: false,
      detect_pcf: false,
      detect_azure: false,
      detect_gcp: false,
      detect_docker: false
    },
    logging: {
      level: 'trace'
    }
  })
  var agent = new Agent(config)

  agent.start(function(error, returned) {
    t.ok(error, 'got an error while attempting to connect')
    t.ok(returned, 'got boot configuration')
    t.notOk(returned.agent_run_id, 'got run ID')
    t.notOk(agent.config.run_id, 'run ID set in configuration')
    t.equal(agent._state, 'errored')
    t.end()
  })
})
