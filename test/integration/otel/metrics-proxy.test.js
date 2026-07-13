/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const test = require('node:test')
const { once } = require('node:events')
const { metrics } = require('@opentelemetry/api')
const helper = require('#testlib/agent_helper.js')
const fakeCert = require('#testlib/fake-cert.js')
const { removeMatchedModules } = require('#testlib/cache-buster.js')
const createOtelMetricsServer = require('./otel-metrics-server.js')
const createProxyServer = require('./proxy-server.js')

async function buildServers(secure = false) {
  const agentConfig = {
    opentelemetry: {
      enabled: true,
      metrics: {
        enabled: true,
        export_interval: 1_001,
        export_timeout: 1_000
      }
    }
  }

  const cert = secure === false ? null : fakeCert({ commonName: 'localhost' })
  const proxyServer = await createProxyServer({ cert })
  if (secure === true) {
    // Send requests that match the SNI in the certificate.
    proxyServer.proxyUrl.replace('127.0.0.1', 'localhost')
    agentConfig.certificates = [cert.certificate]
  }
  agentConfig.proxy = proxyServer.proxyUrl

  const agent = helper.instrumentMockedAgent(agentConfig)
  const guid = 'guid-123456'
  const licenseKey = 'license-123456'
  agent.config.entity_guid = guid
  agent.config.license_key = licenseKey
  agent.config.otlp_resource_attributes = {
    'entity.guid': guid,
    licenseKey
  }
  const dataTracker = {}
  const {
    server: otelServer,
    host,
    port
  } = await createOtelMetricsServer(dataTracker)
  agent.config.host = host
  agent.config.port = port

  return {
    agent,
    dataTracker,
    otelServer,
    proxyServer
  }
}

test.afterEach(() => {
  removeMatchedModules(/http-agents/)
  removeMatchedModules(/generate-proxy-agent-factory/)
  removeMatchedModules(/otel\/metrics\/index\.js/)
})

test('sends metrics through HTTP proxy', { timeout: 5_000 }, async (t) => {
  t.plan(24)

  const { agent, dataTracker, otelServer, proxyServer } = await buildServers()
  t.after(async () => {
    helper.unloadAgent(agent)
    otelServer.close()
    await proxyServer.closeProxy()
  })

  let proxyConnected = false
  proxyServer.on('proxyConnect', (info) => {
    proxyConnected = true
    t.assert.equal(info.host, agent.config.host)
    t.assert.equal(info.port, agent.config.port)
  })

  let proxyDataTransferred = false
  proxyServer.on('proxyData', (info) => {
    if (!proxyDataTransferred) {
      proxyDataTransferred = true
      t.assert.ok(info.bytes > 0)
    }
  })

  // Increment metric prior to the agent being ready:
  const counter = metrics.getMeter('test-meter').createCounter('test-counter')
  counter.add(1, { ready: 'no' })

  // Increment metric after the agent is ready:
  process.nextTick(() => agent.emit('started'))
  await once(agent, 'started')
  counter.add(1, { ready: 'yes' })

  // Increment metric after otel metrics bootstrapping:
  await once(agent, 'otelMetricsBootstrapped')
  counter.add(1, { otel: 'yes' })

  await once(otelServer, 'requestComplete')
  t.assert.equal(dataTracker.path, '/v1/metrics')
  t.assert.equal(dataTracker.headers['api-key'], agent.config.license_key)

  // Verify proxy was used.
  t.assert.equal(proxyConnected, true, 'proxy connection should have been established')
  t.assert.equal(proxyDataTransferred, true, 'data should have been transferred through proxy')
  t.assert.ok(proxyServer.bytesTransferred > 0, 'bytes should have been transferred through proxy')

  // Verify destination OTEL collector received correct data.
  let payload = dataTracker.payload
  let resource = payload.resourceMetrics[0].resource
  t.assert.equal(resource.attributes[0].key, 'entity.guid')
  t.assert.deepEqual(resource.attributes[0].value, { stringValue: 'guid-123456' })

  const found = payload.resourceMetrics[0].scopeMetrics[0].metrics
  t.assert.equal(Array.isArray(found), true)
  t.assert.equal(found.length, 1)
  let metric = found[0]
  t.assert.equal(metric.name, 'test-counter')
  t.assert.equal(metric.sum.dataPoints.length, 1)
  t.assert.equal(metric.sum.dataPoints[0].attributes[0].key, 'ready')
  t.assert.deepEqual(metric.sum.dataPoints[0].attributes[0].value, { stringValue: 'no' })

  await once(otelServer, 'requestComplete')
  payload = dataTracker.payload
  resource = payload.resourceMetrics[0].resource
  t.assert.equal(resource.attributes[0].key, 'entity.guid')
  t.assert.deepEqual(resource.attributes[0].value, { stringValue: 'guid-123456' })
  metric = payload.resourceMetrics[0].scopeMetrics[0].metrics[0]
  t.assert.equal(metric.name, 'test-counter')
  t.assert.equal(metric.sum.dataPoints.length, 2)
  t.assert.equal(metric.sum.dataPoints[0].attributes[0].key, 'ready')
  t.assert.deepEqual(metric.sum.dataPoints[0].attributes[0].value, { stringValue: 'yes' })
  t.assert.equal(metric.sum.dataPoints[1].attributes[0].key, 'otel')
  t.assert.deepEqual(metric.sum.dataPoints[1].attributes[0].value, { stringValue: 'yes' })
})

test('sends metrics through HTTPS proxy', { timeout: 5_000 }, async (t) => {
  t.plan(24)

  const { agent, dataTracker, otelServer, proxyServer } = await buildServers(true)
  t.after(async () => {
    helper.unloadAgent(agent)
    otelServer.close()
    await proxyServer.closeProxy()
  })

  let proxyConnected = false
  proxyServer.on('proxyConnect', (info) => {
    proxyConnected = true
    t.assert.equal(info.host, agent.config.host)
    t.assert.equal(info.port, agent.config.port)
  })

  let proxyDataTransferred = false
  proxyServer.on('proxyData', (info) => {
    if (!proxyDataTransferred) {
      proxyDataTransferred = true
      t.assert.ok(info.bytes > 0)
    }
  })

  // Increment metric prior to the agent being ready:
  const counter = metrics.getMeter('test-meter-https').createCounter('test-counter-https')
  counter.add(1, { ready: 'no' })

  // Increment metric after the agent is ready:
  process.nextTick(() => agent.emit('started'))
  await once(agent, 'started')
  counter.add(1, { ready: 'yes' })

  // Increment metric after otel metrics bootstrapping:
  await once(agent, 'otelMetricsBootstrapped')
  counter.add(1, { otel: 'yes' })

  await once(otelServer, 'requestComplete')
  t.assert.equal(dataTracker.path, '/v1/metrics')
  t.assert.equal(dataTracker.headers['api-key'], agent.config.license_key)

  // Verify proxy was used.
  t.assert.equal(proxyConnected, true, 'proxy connection should have been established')
  t.assert.equal(proxyDataTransferred, true, 'data should have been transferred through proxy')
  t.assert.ok(proxyServer.bytesTransferred > 0, 'bytes should have been transferred through proxy')

  // Verify destination OTEL collector received correct data.
  let payload = dataTracker.payload
  let resource = payload.resourceMetrics[0].resource
  t.assert.equal(resource.attributes[0].key, 'entity.guid')
  t.assert.deepEqual(resource.attributes[0].value, { stringValue: 'guid-123456' })

  const found = payload.resourceMetrics[0].scopeMetrics[0].metrics
  t.assert.equal(Array.isArray(found), true)
  t.assert.equal(found.length, 1)
  let metric = found[0]
  t.assert.equal(metric.name, 'test-counter-https')
  t.assert.equal(metric.sum.dataPoints.length, 1)
  t.assert.equal(metric.sum.dataPoints[0].attributes[0].key, 'ready')
  t.assert.deepEqual(metric.sum.dataPoints[0].attributes[0].value, { stringValue: 'no' })

  await once(otelServer, 'requestComplete')
  payload = dataTracker.payload
  resource = payload.resourceMetrics[0].resource
  t.assert.equal(resource.attributes[0].key, 'entity.guid')
  t.assert.deepEqual(resource.attributes[0].value, { stringValue: 'guid-123456' })
  metric = payload.resourceMetrics[0].scopeMetrics[0].metrics[0]
  t.assert.equal(metric.name, 'test-counter-https')
  t.assert.equal(metric.sum.dataPoints.length, 2)
  t.assert.equal(metric.sum.dataPoints[0].attributes[0].key, 'ready')
  t.assert.deepEqual(metric.sum.dataPoints[0].attributes[0].value, { stringValue: 'yes' })
  t.assert.equal(metric.sum.dataPoints[1].attributes[0].key, 'otel')
  t.assert.deepEqual(metric.sum.dataPoints[1].attributes[0].value, { stringValue: 'yes' })
})
