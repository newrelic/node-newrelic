/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const https = require('node:https')
const path = require('node:path')
const { once } = require('node:events')
const protobuf = require('protobufjs')

const fakeCert = require('#testlib/fake-cert.js')
const helper = require('#testlib/agent_helper.js')

test.beforeEach(async (ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.instrumentMockedAgent({
    opentelemetry_bridge: {
      enabled: true,
      metrics: {
        enabled: true,
        exportInterval: 4_000,
        exportTimeout: 4_000
      }
    }
  })
  ctx.nr.agent.config.entity_guid = 'guid-123456'
  ctx.nr.agent.config.license_key = 'license-123456'

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  const cert = fakeCert()
  const serverOpts = {
    key: cert.privateKeyBuffer,
    cert: cert.certificateBuffer
  }

  ctx.nr.data = {}
  const server = https.createServer(serverOpts, (req, res) => {
    ctx.nr.data.path = req.url
    ctx.nr.data.headers = structuredClone(req.headers)

    let payload = Buffer.alloc(0)
    req.on('data', d => {
      payload = Buffer.concat([payload, d])
    })
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('ok')

      ctx.nr.data.payload = payload
      server.emit('requestComplete', payload)
    })
  })

  ctx.nr.server = server
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', error => {
      if (error) return reject(error)
      ctx.nr.agent.config.host = server.address().address
      ctx.nr.agent.config.port = server.address().port
      resolve()
    })
  })
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
  const otlpSchemas = new protobuf.Root()
  otlpSchemas.resolvePath = (...args) => {
    return path.join(__dirname, 'schemas', args[1])
  }
  await otlpSchemas.load('opentelemetry/proto/collector/metrics/v1/metrics_service.proto')
  const requestSchema = otlpSchemas.lookupType(
    'opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest'
  )

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

  let payload = requestSchema.decode(
    new protobuf.BufferReader(t.nr.data.payload)
  )
  let resource = payload.resourceMetrics[0].resource
  assert.equal(resource.attributes[0].key, 'entity.guid')
  assert.deepEqual(resource.attributes[0].value, { stringValue: 'guid-123456' })

  const found = payload.resourceMetrics[0].scopeMetrics[0].metrics
  assert.equal(Array.isArray(found), true)
  assert.equal(found.length, 1)
  let metric = found[0]
  assert.equal(metric.name, 'test-counter')
  assert.equal(metric.sum.dataPoints.length, 2)
  assert.equal(metric.sum.dataPoints[0].attributes[0].key, 'ready')
  assert.deepEqual(metric.sum.dataPoints[0].attributes[0].value, { stringValue: 'no' })
  assert.equal(metric.sum.dataPoints[1].attributes[0].key, 'ready')
  assert.deepEqual(metric.sum.dataPoints[1].attributes[0].value, { stringValue: 'yes' })

  await once(server, 'requestComplete')
  payload = requestSchema.decode(
    new protobuf.BufferReader(t.nr.data.payload)
  )
  resource = payload.resourceMetrics[0].resource
  assert.equal(resource.attributes[0].key, 'entity.guid')
  assert.deepEqual(resource.attributes[0].value, { stringValue: 'guid-123456' })
  metric = payload.resourceMetrics[0].scopeMetrics[0].metrics[0]
  assert.equal(metric.name, 'test-counter')
  assert.equal(metric.sum.dataPoints.length, 1)
  assert.equal(metric.sum.dataPoints[0].attributes[0].key, 'otel')
  assert.deepEqual(metric.sum.dataPoints[0].attributes[0].value, { stringValue: 'yes' })
})
