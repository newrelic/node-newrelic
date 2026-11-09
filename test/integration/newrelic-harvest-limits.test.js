/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const Collector = require('../lib/test-collector')
const { createMockRequest, jsonReply } = require('./response-handling-utils')
const sinon = require('sinon')
const helper = require('../lib/agent_helper')
const RUN_ID = 'runId'

/**
 * This test asserts that when the agent re-connects it pulls the harvest limits from the original
 * config max_samples_stored for every piece of data. This is done so on restart loops we aren't using
 * the new harvest limit value from server that has been down sampled.  It could result in harvest limits
 * being 0 if enough restarts occur.
 */
test('Connect calls re-generate harvest limits from original config values', async (t) => {
  const serverHarvest = {
    event_harvest_config: {
      report_period_ms: 100,
      harvest_limits: {
        analytic_event_data: 10,
        custom_event_data: 10,
        error_event_data: 1,
        span_event_data: 10,
        log_event_data: 10
      }
    }
  }
  const collector = new Collector({ runId: RUN_ID })
  await collector.listen()
  const mockRequest = createMockRequest(collector)
  // These handlers persist until overwritten, so one registration serves
  // both the initial connect and the 409-triggered reconnect below.
  mockRequest('agent_settings', RUN_ID).reply(200, ...jsonReply({ return_value: [] }))
  mockRequest('preconnect').reply(200, ...jsonReply({
    return_value: { redirect_host: `${collector.host}:${collector.port}`, security_policies: {} }
  }))
  mockRequest('connect').reply(200, ...jsonReply({ return_value: { agent_run_id: RUN_ID, ...serverHarvest } }))
  mockRequest('metric_data', RUN_ID).reply(409, ...jsonReply({ return_value: [] }))
  const agent = helper.loadMockedAgent({
    license_key: 'license key here',
    ...collector.agentConfig,
    application_logging: {
      enabled: true
    },
    utilization: {
      detect_aws: false
    }
  })

  t.after(() => {
    helper.unloadAgent(agent)
    collector.close()
  })

  const originalConfig = Object.assign({}, agent.config)
  agent.config.no_immediate_harvest = true
  sinon.spy(agent.collector, '_connect')

  /**
   * This flow starts agent which pre-connects, connects and gets agent settings.
   * Then we call send metrics and since the metrics collector endpoint is responding
   * with 409 it will issue a restart and make another pre-connect, connect and agent
   * settings call.
   */
  return new Promise((resolve) => {
    agent.start((err) => {
      assert.ok(!err)
      const config = agent.config
      assert.deepEqual(
        config.event_harvest_config,
        serverHarvest.event_harvest_config,
        'config should have been updated from server'
      )
      agent.metrics.once('finished_data_send-metric_data', function onMetricsFinished() {
        const connectCalls = agent.collector._connect.args
        assert.deepEqual(
          config.event_harvest_config,
          serverHarvest.event_harvest_config,
          'config should have been updated from server after reconnect'
        )
        assert.equal(connectCalls.length, 2, 'should have reconnected once')
        connectCalls.forEach((call) => {
          const factsConfig = call[0][0]
          assert.notEqual(
            factsConfig.event_harvest_config.harvest_limits,
            config.event_harvest_config.harvest_limits,
            'facts harvest config should not be same as new harvest config'
          )
          assert.deepEqual(
            factsConfig.event_harvest_config.harvest_limits,
            originalConfig.event_harvest_config.harvest_limits,
            'connect should send up original harvest limits'
          )
        })
        resolve()
      })

      agent.metrics.send()
    })
  })
})
