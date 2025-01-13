/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const nock = require('nock')
const helper = require('../../lib/agent_helper')
const API = require('../../../api')
// This key is hardcoded in the agent helper
const EXPECTED_LICENSE_KEY = 'license key here'
const TEST_DOMAIN = 'test-collector.newrelic.com'
const TEST_COLLECTOR_URL = `https://${TEST_DOMAIN}`

// TODO: should work after the agent has restarted
/**
 * Tests fix for a bug where the agent stayed in a 'connected' state and
 * never hit a 'started' state after a restart. This prevented ever triggering
 * a final harvest, the shutdown callback would never be invoked and the process
 * would not be held open.
 *
 * When broken, the callback is not invoked. The test ends prematurely and the metric_data
 * and shutdown endpoints are left pending in nock.
 *   x test unfinished
 *   x Failed to hit all expected endpoints.
 */
test('#shutdown should force harvest and callback after agent restart', (t, end) => {
  nock.disableNetConnect()

  const agent = helper.loadMockedAgent({
    license_key: EXPECTED_LICENSE_KEY,
    host: TEST_DOMAIN,
    utilization: {
      detect_aws: false
    }
  })

  agent.config.no_immediate_harvest = true

  const api = new API(agent)

  t.after(() => {
    helper.unloadAgent(agent)

    if (!nock.isDone()) {
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())

      nock.cleanAll()

      assert.fail('Failed to hit all expected endpoints.')
    }

    nock.enableNetConnect()
  })

  setupConnectionEndpoints('run-id-1')
  agent.start((error) => {
    assert.ok(!error)

    setupConnectionEndpoints('run-id-2')
    agent.collector.restart(() => {
      const endpoints = setupShutdownEndpoints('run-id-2')
      api.shutdown({ collectPendingData: true }, (error) => {
        assert.ok(!error)

        assert.ok(endpoints.metric_data.isDone())
        assert.ok(endpoints.shutdown.isDone())
        end()
      })
    })
  })
})

function setupShutdownEndpoints(runId) {
  // Final harvest
  return {
    metric_data: nockRequest('metric_data', runId).reply(200),
    shutdown: nockRequest('shutdown', runId).reply(200)
  }
}

function setupConnectionEndpoints(runId) {
  return {
    preconnect: nockRequest('preconnect').reply(200, { return_value: TEST_DOMAIN }),
    connect: nockRequest('connect').reply(200, {
      return_value: {
        agent_run_id: runId
      }
    }),
    settings: nockRequest('agent_settings', runId).reply(200, { return_value: [] })
  }
}

function nockRequest(endpointMethod, runId) {
  const relativepath = helper.generateCollectorPath(endpointMethod, runId)
  return nock(TEST_COLLECTOR_URL).post(relativepath)
}
