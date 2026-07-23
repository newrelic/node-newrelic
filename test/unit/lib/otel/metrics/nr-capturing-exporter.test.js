/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { ExportResultCode } = require('@opentelemetry/core')
const {
  MeterProvider,
  PeriodicExportingMetricReader
} = require('@opentelemetry/sdk-metrics')
const { ProtobufMetricsSerializer } = require('@opentelemetry/otlp-transformer')

const NRCapturingExporter = require('#agentlib/otel/metrics/nr-capturing-exporter.js')

test.beforeEach((ctx) => {
  ctx.nr = {
    logs: []
  }

  ctx.nr.logger = {
    audit(...args) { ctx.nr.logs.push(args) },
    child() { return this }
  }

  ctx.nr.exporter = new NRCapturingExporter({ logger: ctx.nr.logger })

  ctx.nr.reader = new PeriodicExportingMetricReader({
    exporter: {
      export: () => {},
      forceFlush: () => Promise.resolve(),
      shutdown: () => Promise.resolve()
    },
    exportIntervalMillis: 100
  })
  ctx.nr.meterProvider = new MeterProvider({ readers: [ctx.nr.reader] })
})

test.afterEach(async (ctx) => {
  await ctx.nr.meterProvider.shutdown()
})

/**
 * Collects a real `ResourceMetrics` object carrying a single incremented
 * counter so tests can exercise the exporter with genuine data.
 *
 * @param {object} ctx The test context holding the reader/meter provider.
 * @returns {Promise<object>} The collected `ResourceMetrics`.
 */
async function collect(ctx) {
  ctx.nr.meterProvider.getMeter('test-meter').createCounter('test-counter').add(1, { foo: 'bar' })
  const { resourceMetrics } = await ctx.nr.reader.collect()
  return resourceMetrics
}

test('export serializes the metrics and reports success', async (t) => {
  const { exporter } = t.nr
  const metrics = await collect(t)

  let result = null
  exporter.export(metrics, (r) => { result = r })

  // The exporter is synchronous: the callback fires before `export` returns.
  assert.deepEqual(result, { code: ExportResultCode.SUCCESS })

  // The cached payload must match what the OTLP protobuf serializer produces.
  const expected = Buffer.from(ProtobufMetricsSerializer.serializeRequest(metrics)).toString('base64')
  assert.equal(exporter.lastSerialization, expected)
})

test('export writes an audit log of the serialized payload', async (t) => {
  const { exporter } = t.nr
  const metrics = await collect(t)

  exporter.export(metrics, () => {})

  const expected = Buffer.from(ProtobufMetricsSerializer.serializeRequest(metrics)).toString('base64')
  assert.equal(t.nr.logs.length, 1)
  assert.deepEqual(t.nr.logs[0], [
    {
      destUrl: 'local capture',
      data: expected,
      bytes: Buffer.from(expected, 'base64').byteLength
    },
    'Serialized metrics data.'
  ])
})

test('lastSerialization purges the cache on read', async (t) => {
  const { exporter } = t.nr
  const metrics = await collect(t)

  exporter.export(metrics, () => {})

  assert.notEqual(exporter.lastSerialization, '')
  // Reading purges the cache so a subsequent harvest cannot re-flush stale data.
  assert.equal(exporter.lastSerialization, '')
})

test('forceFlush and shutdown resolve without error', async (t) => {
  const { exporter } = t.nr
  await assert.doesNotReject(() => exporter.forceFlush())
  await assert.doesNotReject(() => exporter.shutdown())
})
