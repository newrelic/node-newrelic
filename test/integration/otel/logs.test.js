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
const logsApi = require('@opentelemetry/api-logs')

const fakeCert = require('#testlib/fake-cert.js')
const helper = require('#testlib/agent_helper.js')

test.beforeEach(async (ctx) => {
  process.env.OTEL_BLRP_SCHEDULE_DELAY = 1_000 // Interval for processor to ship logs

  ctx.nr = {}

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
      resolve()
    })
  })

  ctx.nr.agent = helper.instrumentMockedAgent({
    host: server.address().address,
    port: server.address().port,
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
  ctx.nr.server.close()
})

test('sends logs', /* { timeout: 15_000 }, */ async (t) => {
  const { agent, server } = t.nr
  const { logs } = require('@opentelemetry/api-logs')
  const otlpSchemas = new protobuf.Root()
  otlpSchemas.resolvePath = (...args) => {
    return path.join(__dirname, 'schemas', args[1])
  }
  await otlpSchemas.load('opentelemetry/proto/collector/logs/v1/logs_service.proto')
  const requestSchema = otlpSchemas.lookupType(
    'opentelemetry.proto.collector.logs.v1.ExportLogsServiceRequest'
  )

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

  await once(server, 'requestComplete')
  const payload = requestSchema.decode(
    new protobuf.BufferReader(t.nr.data.payload)
  )
  assert.equal(payload.resourceLogs[0].scopeLogs[0].logRecords.length, 1)
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
    'Supportability/Nodejs/OpenTelemetryBridge/Setup',
    'Supportability/Nodejs/OpenTelemetryBridge/Logs'
  ]
  for (const expectedMetricName of expectedMetricNames) {
    assert.equal(supportMetrics[expectedMetricName].callCount, 1)
  }
})
