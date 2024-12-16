/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const configurator = require('../../lib/config')
const Agent = require('../../lib/agent')
const CollectorAPI = require('../../lib/collector/api')
const { getTestSecret } = require('../helpers/secrets')
const laspLicense = getTestSecret('LASP_LICENSE')
const laspSecureLicense = getTestSecret('LASP_SECURE_LICENSE')

test('connecting with a LASP token should not error', (t, end) => {
  const config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: laspLicense,
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

  api.connect(function (error, response) {
    assert.ok(!error, 'connected without error')

    const returned = response && response.payload
    assert.ok(returned, 'got boot configuration')
    assert.ok(returned.agent_run_id, 'got run ID')
    assert.ok(agent.config.run_id, 'run ID set in configuration')

    api.shutdown(function (error) {
      assert.ok(!error, 'should have shut down without issue')
      assert.ok(!agent.config.run_id, 'run ID should have been cleared by shutdown')
      end()
    })
  })
})

test('missing required policies should result in shutdown', (t, end) => {
  const config = configurator.initialize({
    app_name: 'node.js Tests',
    license_key: laspSecureLicense,
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

  agent.start(function (error, response) {
    assert.ok(error, 'should have error')
    assert.equal(error.message, 'Failed to connect to collector')
    assert.ok(!response, 'should not have response payload')
    assert.equal(agent._state, 'errored')
    end()
  })
})
