/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { once } = require('node:events')
const helper = require('#testlib/agent_helper.js')
const createOtelMetricsServer = require('./otel-metrics-server.js')

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    opentelemetry: {
      enabled: true,
      metrics: {
        enabled: true,
        export_interval: 1_001,
        export_timeout: 1_000
      }
    }
  })
  const guid = 'guid-123456'
  const licenseKey = 'license-123456'
  ctx.nr.agent.config.entity_guid = guid
  ctx.nr.agent.config.license_key = licenseKey
  ctx.nr.agent.config.otlp_resource_attributes = {
    'entity.guid': guid,
    licenseKey
  }

  ctx.nr.data = {}
  const otelServer = await createOtelMetricsServer(ctx.nr.data)
  ctx.nr.server = otelServer.server
  ctx.nr.agent.config.host = otelServer.host
  ctx.nr.agent.config.port = otelServer.port
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  ctx.nr.server.close()
})

test('sends metrics', { timeout: 5_000 }, async (t) => {
  // This test verifies that the metrics exporter ships expected metrics
  // data, with the correct `entity.guid` attached, to the backend system.
  // Due to the way bootstrapping of the metrics API client works, there will
  // be two network requests: the first with metrics recorded prior to the
  // API client being ready, and the second with a singular metric recorded
  // by the fully configured and ready API client.

  const { agent, server } = t.nr
  const { metrics } = require('@opentelemetry/api')

  // Add increment a metric prior to the agent being ready:
  const counter = metrics.getMeter('test-meter').createCounter('test-counter')
  counter.add(1, { ready: 'no' })

  // Increment metric after the agent is ready:
  process.nextTick(() => agent.emit('started'))
  await once(agent, 'started')
  counter.add(1, { ready: 'yes' })

  // Increment metric after otel metrics bootstrapping:
  await once(agent, 'otelMetricsBootstrapped')
  counter.add(1, { otel: 'yes' })

  await once(server, 'requestComplete')
  assert.equal(t.nr.data.path, '/v1/metrics')
  assert.equal(t.nr.data.headers['api-key'], agent.config.license_key)

  let payload = t.nr.data.payload
  let resource = payload.resourceMetrics[0].resource
  assert.equal(resource.attributes[0].key, 'entity.guid')
  assert.deepEqual(resource.attributes[0].value, { stringValue: 'guid-123456' })

  const found = payload.resourceMetrics[0].scopeMetrics[0].metrics
  assert.equal(Array.isArray(found), true)
  assert.equal(found.length, 1)
  let metric = found[0]
  assert.equal(metric.name, 'test-counter')
  assert.equal(metric.sum.dataPoints.length, 1)
  assert.equal(metric.sum.dataPoints[0].attributes[0].key, 'ready')
  assert.deepEqual(metric.sum.dataPoints[0].attributes[0].value, { stringValue: 'no' })

  await once(server, 'requestComplete')
  payload = t.nr.data.payload
  resource = payload.resourceMetrics[0].resource
  assert.equal(resource.attributes[0].key, 'entity.guid')
  assert.deepEqual(resource.attributes[0].value, { stringValue: 'guid-123456' })
  metric = payload.resourceMetrics[0].scopeMetrics[0].metrics[0]
  assert.equal(metric.name, 'test-counter')
  assert.equal(metric.sum.dataPoints.length, 2)
  assert.equal(metric.sum.dataPoints[0].attributes[0].key, 'ready')
  assert.deepEqual(metric.sum.dataPoints[0].attributes[0].value, { stringValue: 'yes' })
  assert.equal(metric.sum.dataPoints[1].attributes[0].key, 'otel')
  assert.deepEqual(metric.sum.dataPoints[1].attributes[0].value, { stringValue: 'yes' })

  const supportMetrics = agent.metrics._metrics.unscoped
  const expectedMetricNames = [
    'Supportability/Nodejs/OpenTelemetryBridge/Setup',
    'Supportability/Metrics/Nodejs/OpenTelemetryBridge/enabled',
    'Supportability/Metrics/Nodejs/OpenTelemetryBridge/getMeter',
    'Supportability/Metrics/Nodejs/OpenTelemetryBridge/meter/createCounter'
  ]
  for (const expectedMetricName of expectedMetricNames) {
    assert.equal(supportMetrics[expectedMetricName].callCount, 1)
  }
})
