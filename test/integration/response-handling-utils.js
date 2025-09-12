/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const nock = require('nock')
const helper = require('../lib/agent_helper')
const TEST_DOMAIN = 'test-collector.newrelic.com'
const TEST_COLLECTOR_URL = `https://${TEST_DOMAIN}`
const RUN_ID = 'runId'

const endpointDataChecks = {
  metric_data: function hasMetricData(agent) {
    return !!agent.metrics.getMetric('myMetric')
  },
  error_event_data: function hasErrorEventData(agent) {
    return agent.errors.eventAggregator.events.length > 0
  },
  error_data: function hasErrorData(agent) {
    return agent.errors.traceAggregator.errors.length > 0
  },
  analytic_event_data: function hasTransactionEventData(agent) {
    return agent.transactionEventAggregator.length > 0
  },
  transaction_sample_data: function hasTransactionTraceData(agent) {
    return !!agent.traces.trace
  },
  span_event_data: function hasSpanEventData(agent) {
    return agent.spanEventAggregator.length > 0
  },
  custom_event_data: function hasCustomEventData(agent) {
    // TODO... prob don't need to grab events
    return agent.customEventAggregator.length > 0
  },
  sql_trace_data: function hasSqlTraceData(agent) {
    return agent.queries.samples.size > 0
  }
}

/**
 * Adds data to agent instance for use in endpoint tests.
 * Each type is added every test, even though not all endpoints are mocked.
 * This allows for verifying response handling for endpoint under test still
 * behaves correctly when other endpoints fail.
 * @param {*} agent The agent instance to add data to
 * @param {*} callback
 */
function createTestData(agent, callback) {
  const metric = agent.metrics.getOrCreateMetric('myMetric')
  metric.incrementCallCount()

  agent.errors.addUserError(null, new Error('Why?!!!?!!'))

  agent.customEventAggregator.add([{ type: 'MyCustomEvent', timestamp: Date.now() }])

  helper.runInTransaction(agent, (transaction) => {
    const segment = transaction.trace.add('MySegment')
    segment.overwriteDurationInMillis(1)
    agent.queries.add({
      segment,
      transaction,
      type: 'mysql',
      query: 'select * from foo',
      trace: new Error().stack
    })

    transaction.finalizeNameFromWeb(200)
    transaction.end()
    callback()
  })
}

function verifyAgentStart(t, error) {
  const { startEndpoints } = t.nr
  if (error) {
    throw error
  }

  assert.ok(startEndpoints.preconnect.isDone(), 'requested preconnect')
  assert.ok(startEndpoints.connect.isDone(), 'requested connect')
  assert.ok(startEndpoints.settings.isDone(), 'requested settings')
}

function verifyRunBehavior(t) {
  const { connecting, disconnected, restartEndpoints, shutdown, started, testCase } = t.nr
  if (testCase.disconnect) {
    assert.ok(disconnected, 'should have disconnected')
    assert.ok(!connecting, 'should not have reconnected')

    assert.ok(shutdown.isDone(), 'requested shutdown')
  } else if (testCase.restart) {
    assert.ok(disconnected, 'should have disconnected')
    assert.ok(connecting, 'should have started reconnecting')
    assert.ok(started, 'should have set agent to started')

    assert.ok(restartEndpoints.preconnect.isDone(), 'requested preconnect')
    assert.ok(restartEndpoints.connect.isDone(), 'requested connect')
    assert.ok(restartEndpoints.settings.isDone(), 'requested settings')
  } else {
    assert.ok(!disconnected, 'should not have disconnected')
    assert.ok(!connecting, 'should not have reconnected')
  }
}

function verifyDataRetention({ t, checkHasTestData, endpointName }) {
  const { agent, testCase } = t.nr
  const hasDataPostHarvest = checkHasTestData(agent)
  if (testCase.retain_data) {
    assert.ok(hasDataPostHarvest, `should have retained data after ${endpointName} call`)
  } else {
    assert.ok(!hasDataPostHarvest, `should not have retained data after ${endpointName} call`)
  }
}

function whenAllAggregatorsSend(agent) {
  const metricPromise = new Promise((resolve) => {
    agent.metrics.once('finished_data_send-metric_data', function onMetricsFinished() {
      resolve()
    })
  })

  const spanPromise = new Promise((resolve) => {
    agent.spanEventAggregator.once(
      'finished_data_send-span_event_data',
      function onSpansFinished() {
        resolve()
      }
    )
  })

  const customEventPromise = new Promise((resolve) => {
    agent.customEventAggregator.once(
      'finished_data_send-custom_event_data',
      function onCustomEventsFinished() {
        resolve()
      }
    )
  })

  const transactionEventPromise = new Promise((resolve) => {
    agent.transactionEventAggregator.once(
      'finished_data_send-analytic_event_data',
      function onTransactionEventsFinished() {
        resolve()
      }
    )
  })

  const transactionTracePromise = new Promise((resolve) => {
    agent.traces.once('finished_data_send-transaction_sample_data', function onTracesFinished() {
      resolve()
    })
  })

  const sqlTracePromise = new Promise((resolve) => {
    agent.queries.once('finished_data_send-sql_trace_data', function onSqlTracesFinished() {
      resolve()
    })
  })

  const errorTracePromise = new Promise((resolve) => {
    agent.errors.traceAggregator.once(
      'finished_data_send-error_data',
      function onErrorTracesFinished() {
        resolve()
      }
    )
  })

  const errorEventPromise = new Promise((resolve) => {
    agent.errors.eventAggregator.once(
      'finished_data_send-error_event_data',
      function onErrorEventsFinished() {
        resolve()
      }
    )
  })

  const promises = [
    metricPromise,
    spanPromise,
    customEventPromise,
    transactionEventPromise,
    transactionTracePromise,
    sqlTracePromise,
    errorTracePromise,
    errorEventPromise
  ]

  return Promise.all(promises)
}

function setupConnectionEndpoints() {
  return {
    preconnect: nockRequest('preconnect').reply(200, { return_value: TEST_DOMAIN }),
    connect: nockRequest('connect').reply(200, { return_value: { agent_run_id: RUN_ID } }),
    settings: nockRequest('agent_settings', RUN_ID).reply(200, { return_value: [] })
  }
}

function nockRequest(endpointMethod, runId, bodyMatcher) {
  const relativepath = helper.generateCollectorPath(endpointMethod, runId)
  return nock(TEST_COLLECTOR_URL).post(relativepath, bodyMatcher)
}

module.exports = {
  createTestData,
  endpointDataChecks,
  nockRequest,
  setupConnectionEndpoints,
  RUN_ID,
  TEST_DOMAIN,
  whenAllAggregatorsSend,
  verifyAgentStart,
  verifyDataRetention,
  verifyRunBehavior
}
