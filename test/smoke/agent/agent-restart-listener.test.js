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
      detect_aws: true,
      detect_pcf: true,
      detect_gcp: true,
      detect_docker: true
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

    const initialStoppedListeners = agent.listenerCount('stopped')
    const initialErroredListeners = agent.listenerCount('errored')
    const initialDisconnectedListeners = agent.listenerCount('disconnected')

    agent.collector.restart(() => {
      const currentStoppedListeners = agent.listenerCount('stopped')
      const currentErroredListeners = agent.listenerCount('errored')
      const currentDisconnectedListeners = agent.listenerCount('disconnected')
      assert.equal(
        currentStoppedListeners,
        initialStoppedListeners,
        'should not have extra stopped listeners'
      )
      assert.equal(
        currentErroredListeners,
        initialErroredListeners,
        'should not have extra errored listeners'
      )
      assert.equal(
        currentDisconnectedListeners,
        initialDisconnectedListeners,
        'should not have extra disconnected listeners'
      )

      agent.stop(() => {
        end()
      })
    })
  })
})
