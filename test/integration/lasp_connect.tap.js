'use strict'

const tap = require('tap')
const configurator = require('../../lib/config')
const Agent = require('../../lib/agent')
const CollectorAPI = require('../../lib/collector/api')

tap.test('connecting with a LASP token should not error', function(t) {
  const config = configurator.initialize({
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
  const agent = new Agent(config)
  const api = new CollectorAPI(agent)

  api.connect(function(error, response) {
    t.notOk(error, 'connected without error')

    const returned = response && response.payload
    t.ok(returned, 'got boot configuration')
    t.ok(returned.agent_run_id, 'got run ID')
    t.ok(agent.config.run_id, 'run ID set in configuration')

    api.shutdown(function(error) {
      t.notOk(error, 'should have shut down without issue')
      t.notOk(agent.config.run_id, 'run ID should have been cleared by shutdown')
      t.end()
    })
  })
})

tap.test('missing required policies should result in shutdown', function(t) {
  const config = configurator.initialize({
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
  const agent = new Agent(config)

  agent.start(function(error, response) {
    t.ok(error, 'should have error')
    t.equal(error.message, 'Failed to connect to collector')
    t.notOk(response, 'should not have response payload')
    t.equal(agent._state, 'errored')
    t.end()
  })
})
