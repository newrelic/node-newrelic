/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { once } = require('node:events')
const logsApi = require('@opentelemetry/api-logs')

const helper = require('#testlib/agent_helper.js')

test.beforeEach(async (ctx) => {
  process.env.OTEL_BLRP_SCHEDULE_DELAY = 1_000 // Interval for processor to ship logs

  ctx.nr = {}

  ctx.nr.agent = helper.instrumentMockedAgent({
    opentelemetry_bridge: {
      enabled: true,
      logs: {
        enabled: true
      }
    }
  })
  ctx.nr.agent.config.entity_guid = 'guid-123456'
  ctx.nr.agent.config.license_key = 'license-123456'
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('sends logs', { timeout: 5_000 }, async (t) => {
  const { agent } = t.nr
  const { logs } = require('@opentelemetry/api-logs')

  process.nextTick(() => agent.emit('started'))
  await once(agent, 'started')

  const logger = logs.getLogger('testLogger')
  logger.emit({
    severityNumber: logsApi.SeverityNumber.INFO,
    body: 'test log',
    timestamp: new Date(1752516000000), // 2025-07-14T14:00:00.000-04:00
    attributes: {
      foo: 'bar'
    }
  })

  assert.equal(agent.logs.length, 1)
  const nrShippedLogs = agent.logs._toPayloadSync()
  assert.equal(nrShippedLogs.length, 1)
  assert.equal(nrShippedLogs[0].common.attributes['entity.guid'], 'guid-123456')

  const log = nrShippedLogs[0].logs[0]
  assert.equal(log['entity.guid'], 'guid-123456')
  assert.equal(log['entity.name'], 'New Relic for Node.js tests')
  assert.equal(log['entity.type'], 'SERVICE')
  assert.ok(log['hostname'])
  assert.equal(log.level, 'info')
  assert.equal(log.message, 'test log')
  assert.equal(Number.isFinite(log.timestamp), true)
  assert.equal(log.timestamp, 1752516000000)
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
    assert.equal(supportMetrics[expectedMetricName].callCount, 1)
  }
})
