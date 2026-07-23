/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const {
  MeterProvider,
  PeriodicExportingMetricReader
} = require('@opentelemetry/sdk-metrics')
const { ProtobufMetricsSerializer } = require('@opentelemetry/otlp-transformer')
const NRProxyingSerializer = require('#agentlib/otel/metrics/nr-proxying-serializer.js')

test.beforeEach((ctx) => {
  ctx.nr = {
    logs: []
  }

  ctx.nr.logger = {
    auditEnabled() { return true },
    audit(...args) { ctx.nr.logs.push(args) },
    child() { return this }
  }

  ctx.nr.serializer = new NRProxyingSerializer({
    destinationUrl: 'http://example.com:1234/v1/metrics',
    logger: ctx.nr.logger
  })
  ctx.nr.reader = new PeriodicExportingMetricReader({
    exporter: {
      export: () => {},
      forceFlush: () => Promise.resolve(),
      shutdown: () => Promise.resolve()
    },
    exportIntervalMillis: 100
  })
  ctx.nr.meterProvider = new MeterProvider({
    readers: [ctx.nr.reader]
  })
})

test.afterEach(async (ctx) => {
  await ctx.nr.meterProvider.shutdown()
})

test('logs when serializing', async (t) => {
  const { meterProvider, reader, serializer } = t.nr
  const meter = meterProvider.getMeter('test-meter')
  const counter = meter.createCounter('test-counter')
  counter.add(1, { foo: 'bar' })

  const collected = await reader.collect()
  const input = collected.resourceMetrics
  const expected = ProtobufMetricsSerializer.serializeRequest(input)
  const found = serializer.serializeRequest(input)

  assert.equal(Buffer.compare(found, expected), 0)
  const buffer = Buffer.from(found)
  assert.deepEqual(
    t.nr.logs[0],
    [
      {
        destUrl: 'http://example.com:1234/v1/metrics',
        data: buffer.toString('base64'),
        bytes: buffer.byteLength
      },
      'Serialized metrics data.'
    ]
  )
})

test('logs when deserializing', async (t) => {
  const { meterProvider, reader, serializer } = t.nr

  const meter = meterProvider.getMeter('test-meter')
  const counter = meter.createCounter('test-counter')
  counter.add(42, { test: 'deserialize' })

  const collected = await reader.collect()
  const metricsData = collected.resourceMetrics
  const input = ProtobufMetricsSerializer.serializeRequest(metricsData)
  const expected = ProtobufMetricsSerializer.deserializeResponse(input)
  const found = serializer.deserializeResponse(input)

  assert.deepEqual(found, expected)

  const buffer = Buffer.from(input)
  assert.deepEqual(
    t.nr.logs[0],
    [
      {
        data: buffer.toString('base64')
      },
      'Received response data.'
    ]
  )
})

test('does not log when audit logging is disabled', async (t) => {
  const { meterProvider, reader, serializer } = t.nr
  t.nr.logger.auditEnabled = () => false
  const meter = meterProvider.getMeter('test-meter')
  const counter = meter.createCounter('test-counter')
  counter.add(1, { foo: 'bar' })

  const collected = await reader.collect()
  const input = collected.resourceMetrics
  const expected = ProtobufMetricsSerializer.serializeRequest(input)
  const found = serializer.serializeRequest(input)

  assert.equal(Buffer.compare(found, expected), 0)
  assert.deepEqual(t.nr.logs, [])
})
