/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const nock = require('nock')
const sinon = require('sinon')
const helper = require('../lib/agent_helper')
const TEST_DOMAIN = 'test-collector.newrelic.com'
const TEST_COLLECTOR_URL = `https://${TEST_DOMAIN}`
const RUN_ID = 'runId'

function nockRequest(endpointMethod, runId) {
  const relativepath = helper.generateCollectorPath(endpointMethod, runId)
  return nock(TEST_COLLECTOR_URL).post(relativepath)
}

/**
 * This test asserts that when the agent re-connects it pulls the harvest limits from the original
 * config max_samples_stored for every piece of data. This is done so on restart loops we aren't using
 * the new harvest limit value from server that has been down sampled.  It could result in harvest limits
 * being 0 if enough restarts occur.
 */
tap.test('Connect calls re-generate harvest limits from original config values', (t) => {
  let agent
  let serverHarvest

  t.before(() => {
    serverHarvest = {
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
    nock.disableNetConnect()
    nockRequest('preconnect').reply(200, { return_value: TEST_DOMAIN })
    nockRequest('connect').reply(200, { return_value: { agent_run_id: RUN_ID, ...serverHarvest } })
    nockRequest('agent_settings', RUN_ID).reply(200, { return_value: [] })
    nockRequest('metric_data', RUN_ID).reply(409, { return_value: [] })
    nockRequest('preconnect').reply(200, { return_value: TEST_DOMAIN })
    nockRequest('connect').reply(200, { return_value: { agent_run_id: RUN_ID, ...serverHarvest } })
    nockRequest('agent_settings', RUN_ID).reply(200, { return_value: [] })
    agent = helper.loadMockedAgent({
      license_key: 'license key here',
      host: TEST_DOMAIN,
      application_logging: {
        enabled: true
      }
    })
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
    if (!nock.isDone()) {
      // eslint-disable-next-line no-console
      console.error('Cleaning pending mocks: %j', nock.pendingMocks())
      nock.cleanAll()
    }

    nock.enableNetConnect()
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
  agent.start((err) => {
    t.error(err)
    const config = agent.config
    t.same(
      config.event_harvest_config,
      serverHarvest.event_harvest_config,
      'config should have been updated from server'
    )
    agent.metrics.once('finished_data_send-metric_data', function onMetricsFinished() {
      const connectCalls = agent.collector._connect.args
      t.same(
        config.event_harvest_config,
        serverHarvest.event_harvest_config,
        'config should have been updated from server after reconnect'
      )
      t.equal(connectCalls.length, 2, 'should have reconnected once')
      connectCalls.forEach((call) => {
        const factsConfig = call[0][0]
        t.not(
          factsConfig.event_harvest_config.harvest_limits,
          config.event_harvest_config.harvest_limits,
          'facts harvest config should not be same as new harvest config'
        )
        t.same(
          factsConfig.event_harvest_config.harvest_limits,
          originalConfig.event_harvest_config.harvest_limits,
          'connect should send up original harvest limits'
        )
      })
      t.end()
    })

    agent.metrics.send()
  })
})
