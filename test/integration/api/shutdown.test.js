/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const Collector = require('../../lib/test-collector')
const helper = require('../../lib/agent_helper')
const { jsonReply, createMockRequest } = require('../../lib/collector-reply-utils')
const API = require('../../../api')

// TODO: should work after the agent has restarted
/**
 * Tests fix for a bug where the agent stayed in a 'connected' state and
 * never hit a 'started' state after a restart. This prevented ever triggering
 * a final harvest, the shutdown callback would never be invoked and the process
 * would not be held open.
 *
 * When broken, the callback is not invoked. The test ends prematurely and the metric_data
 * and shutdown endpoints are left pending.
 *   x test unfinished
 *   x Failed to hit all expected endpoints.
 */
test('#shutdown should force harvest and callback after agent restart', async (t) => {
  const collector = new Collector({ runId: 'run-id-1' })
  await collector.listen()
  const mockRequest = createMockRequest(collector)

  const agent = helper.loadMockedAgent({
    ...collector.agentConfig,
    utilization: {
      detect_aws: false
    }
  })

  agent.config.no_immediate_harvest = true

  const api = new API(agent)

  t.after(() => {
    helper.unloadAgent(agent)

    const pending = collector.pendingHandlers()
    collector.close()
    assert.deepStrictEqual(pending, [], `Failed to hit all expected endpoints: ${pending}`)
  })

  setupConnectionEndpoints(mockRequest, collector, 'run-id-1')
  return new Promise((resolve) => {
    agent.start((error) => {
      assert.ok(!error)

      setupConnectionEndpoints(mockRequest, collector, 'run-id-2')
      agent.collector.restart(() => {
        const endpoints = setupShutdownEndpoints(mockRequest, 'run-id-2')
        api.shutdown({ collectPendingData: true }, (error) => {
          assert.ok(!error)

          assert.ok(endpoints.metric_data.isDone())
          assert.ok(endpoints.shutdown.isDone())
          resolve()
        })
      })
    })
  })
})

function setupShutdownEndpoints(mockRequest, runId) {
  // Final harvest
  return {
    metric_data: mockRequest('metric_data', runId).reply(200, ...jsonReply({ return_value: null })),
    shutdown: mockRequest('shutdown', runId).reply(200, ...jsonReply({ return_value: null }))
  }
}

function setupConnectionEndpoints(mockRequest, collector, runId) {
  return {
    preconnect: mockRequest('preconnect').reply(200, ...jsonReply({
      return_value: {
        redirect_host: `${collector.host}:${collector.port}`,
        security_policies: {}
      }
    })),
    connect: mockRequest('connect').reply(200, ...jsonReply({
      return_value: {
        agent_run_id: runId
      }
    })),
    settings: mockRequest('agent_settings', runId).reply(200, ...jsonReply({ return_value: [] }))
  }
}
