/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const logsApi = require('@opentelemetry/api-logs')

const helper = require('#testlib/agent_helper.js')

const BASE_AGENT_CONFIG = {
  opentelemetry_bridge: {
    enabled: true,
    logs: { enabled: true }
  }
}
const TS_FIXTURE = 1752516000000 // 2025-07-14T14:00:00.000-04:00

test.beforeEach(async (ctx) => {
  process.env.OTEL_BLRP_SCHEDULE_DELAY = 1_000 // Interval for processor to ship logs
  ctx.nr = {}
})

test.afterEach((ctx) => {
  delete process.env.OTEL_BLRP_SCHEDULE_DELAY
  helper.unloadAgent(ctx.nr.agent)
})

function initAgent({ t, config = BASE_AGENT_CONFIG }) {
  t.nr.agent = helper.instrumentMockedAgent(config)
  t.nr.agent.config.entity_guid = 'guid-123456'
  t.nr.agent.config.license_key = 'license-123456'

  return t.nr.agent
}

test('sends logs outside of transaction', async (t) => {
  const agent = initAgent({ t })
  const { logs } = require('@opentelemetry/api-logs')

  const logger = logs.getLogger('testLogger')
  logger.emit({
    severityNumber: logsApi.SeverityNumber.INFO,
    body: 'test log outside of transaction',
    timestamp: new Date(TS_FIXTURE),
    attributes: {
      foo: 'bar'
    }
  })

  assert.equal(agent.logs.length, 1)
  const nrShippedLogs = agent.logs._toPayloadSync()
  assert.equal(nrShippedLogs.length, 1)
  assert.equal(nrShippedLogs[0].common.attributes['entity.guid'], 'guid-123456')
  assert.equal(nrShippedLogs[0].common.attributes['entity.name'], 'New Relic for Node.js tests')
  assert.equal(nrShippedLogs[0].common.attributes['entity.type'], 'SERVICE')
  assert.ok(nrShippedLogs[0].common.attributes.hostname)

  const log = nrShippedLogs[0].logs[0]
  assert.equal(log['entity.guid'], undefined)
  assert.equal(log['entity.name'], undefined)
  assert.equal(log['entity.type'], undefined)
  assert.equal(log.hostname, undefined)
  assert.equal(log.level, 'info')
  assert.equal(log.message, 'test log outside of transaction')
  assert.equal(Number.isFinite(log.timestamp), true)
  assert.equal(log.timestamp, TS_FIXTURE)
  assert.equal(log.foo, 'bar')

  const supportMetrics = agent.metrics._metrics.unscoped
  const expectedMetricNames = [
    'Logging/lines',
    'Logging/lines/INFO',
    'Supportability/Logging/Forwarding/Seen',
    'Supportability/Logging/Forwarding/Sent',
    'Supportability/Nodejs/OpenTelemetryBridge/Logs',
    'Supportability/Nodejs/OpenTelemetryBridge/Setup'
  ]
  for (const expectedMetricName of expectedMetricNames) {
    assert.equal(supportMetrics[expectedMetricName].callCount, 1, `${expectedMetricName} is present`)
  }
})

test('sends logs within transaction', (t, end) => {
  const agent = initAgent({ t })
  const { logs } = require('@opentelemetry/api-logs')
  const logger = logs.getLogger('testLogger')

  helper.runInTransaction(agent, tx => {
    logger.emit({
      severityNumber: logsApi.SeverityNumber.INFO,
      body: 'test log in transaction',
      timestamp: new Date(TS_FIXTURE),
      attributes: {
        foo: 'bar',
        agent
      }
    })
    assert.equal(agent.logs.length, 0, 'should not add to non-tx logs array')

    const span = tx.trace.root
    tx.end()

    const txLogs = tx.logs.aggregator.getEvents()
    assert.equal(txLogs.length, 1)

    const log = txLogs[0]
    assert.equal(log['trace.id'], tx.traceId)
    assert.equal(log['span.id'], span.id)
    assert.equal(log.foo, 'bar')

    end()
  })
})

test('omits logging metrics when disabled', async (t) => {
  const agentConfig = Object.assign(
    {},
    structuredClone(BASE_AGENT_CONFIG),
    {
      application_logging: {
        metrics: { enabled: false }
      }
    }
  )
  const agent = initAgent({ t, config: agentConfig })
  const { logs } = require('@opentelemetry/api-logs')

  const logger = logs.getLogger('testLogger')
  logger.emit({
    severityNumber: logsApi.SeverityNumber.INFO,
    body: 'test log metrics disabled',
    timestamp: new Date(TS_FIXTURE),
    attributes: {
      foo: 'bar'
    }
  })

  assert.equal(agent.logs.length, 1)
  const nrShippedLogs = agent.logs._toPayloadSync()
  const log = nrShippedLogs[0].logs[0]
  assert.equal(log.message, 'test log metrics disabled')

  const supportMetrics = agent.metrics._metrics.unscoped
  const expectedMetricNames = [
    'Logging/lines',
    'Logging/lines/INFO'
  ]
  for (const expectedMetricName of expectedMetricNames) {
    assert.equal(supportMetrics[expectedMetricName], undefined, `${expectedMetricName} not present`)
  }
})

test('does not forward logs when disabled', async (t) => {
  const agentConfig = Object.assign(
    {},
    structuredClone(BASE_AGENT_CONFIG),
    {
      application_logging: {
        metrics: { enabled: true },
        forwarding: { enabled: false }
      }
    }
  )
  const agent = initAgent({ t, config: agentConfig })
  const { logs } = require('@opentelemetry/api-logs')

  const logger = logs.getLogger('testLogger')
  logger.emit({
    severityNumber: logsApi.SeverityNumber.INFO,
    body: 'test log no forwarding',
    timestamp: new Date(TS_FIXTURE),
    attributes: {
      foo: 'bar'
    }
  })

  assert.equal(agent.logs.length, 0)

  const supportMetrics = agent.metrics._metrics.unscoped
  let expectedMetricNames = [
    'Supportability/Logging/Forwarding/Seen',
    'Supportability/Logging/Forwarding/Sent',
  ]
  for (const expectedMetricName of expectedMetricNames) {
    assert.equal(supportMetrics[expectedMetricName], undefined, `${expectedMetricName} not present`)
  }
  expectedMetricNames = [
    'Logging/lines',
    'Logging/lines/INFO',
    'Supportability/Nodejs/OpenTelemetryBridge/Logs',
    'Supportability/Nodejs/OpenTelemetryBridge/Setup'
  ]
  for (const expectedMetricName of expectedMetricNames) {
    assert.equal(supportMetrics[expectedMetricName].callCount, 1, `${expectedMetricName} is present`)
  }
})
