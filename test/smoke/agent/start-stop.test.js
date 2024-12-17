/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const configurator = require('../../../lib/config')
const Agent = require('../../../lib/agent')
const { getTestSecret } = require('../../helpers/secrets')

const license = getTestSecret('TEST_LICENSE')
test('Collector API should connect to staging-collector.newrelic.com', (t, end) => {
  const config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: license,
    host: 'staging-collector.newrelic.com',
    port: 443,
    ssl: true,
    utilization: {
      detect_aws: false,
      detect_pcf: false,
      detect_gcp: false,
      detect_docker: false
    },
    logging: {
      level: 'trace'
    }
  })
  const agent = new Agent(config)

  agent.start((error, returned) => {
    assert.ok(!error, 'connected without error')
    assert.ok(returned, 'got boot configuration')
    assert.ok(returned.agent_run_id, 'got run ID')
    assert.ok(agent.config.run_id, 'run ID set in configuration')

    agent.stop((error) => {
      assert.ok(!error, 'should have shut down without issue')
      assert.ok(!agent.config.run_id, 'run ID should have been cleared by shutdown')

      end()
    })
  })
})
