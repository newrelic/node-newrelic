'use strict'

const tap = require('tap')
const configurator = require('../../lib/config')
const Agent = require('../../lib/agent')
const CollectorAPI = require('../../lib/collector/api')

tap.test('no proxy set should not use proxy agent [SECRETS]', (t) => {
  const config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: process.env.TEST_LICENSE,
    host: 'staging-collector.newrelic.com',
    port: 443,
    ssl: true,
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


  api.connect((error, response) => {
    t.notOk(error, 'connected without error')

    const returned = response && response.payload
    t.ok(returned, 'got boot configuration')
    t.ok(returned.agent_run_id, 'got run ID')
    t.ok(agent.config.run_id, 'run ID set in configuration')

    api.shutdown((error) => {
      t.notOk(error, 'should have shut down without issue')
      t.notOk(agent.config.run_id, 'run ID should have been cleared by shutdown')

      t.end()
    })
  })
})
