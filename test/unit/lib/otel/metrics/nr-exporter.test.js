/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { ExportResultCode } = require('@opentelemetry/core')
const {
  MeterProvider,
  PeriodicExportingMetricReader
} = require('@opentelemetry/sdk-metrics')
const { ProtobufMetricsSerializer } = require('@opentelemetry/otlp-transformer')

const NROTLPMetricExporter = require('#agentlib/otel/metrics/nr-exporter.js')
const NRProxyingDelegate = require('#agentlib/otel/metrics/nr-proxying-delegate.js')

/**
 * Collects a real `ResourceMetrics` object containing a single incremented
 * counter, so tests can exercise the serialization path with genuine data.
 *
 * @returns {Promise<object>} The collected `ResourceMetrics`.
 */
async function collectResourceMetrics() {
  const reader = new PeriodicExportingMetricReader({
    exporter: {
      export: () => {},
      forceFlush: () => Promise.resolve(),
      shutdown: () => Promise.resolve()
    },
    exportIntervalMillis: 100
  })
  const meterProvider = new MeterProvider({ readers: [reader] })
  const meter = meterProvider.getMeter('test-meter')
  meter.createCounter('test-counter').add(1, { foo: 'bar' })

  const { resourceMetrics } = await reader.collect()
  await meterProvider.shutdown()
  return resourceMetrics
}

test.beforeEach((ctx) => {
  ctx.nr = {}

  ctx.nr.logger = {
    auditEnabled() { return true },
    audit() {},
    child() { return this }
  }

  ctx.nr.agent = {
    metrics: {
      getOrCreateMetric() {
        return { incrementCallCount() {} }
      }
    }
  }
})

test(
  'export result from the wrapped delegate reaches the caller through NROTLPMetricExporter',
  (t, done) => {
    const { agent, logger } = t.nr

    const exporter = new NROTLPMetricExporter(
      { url: 'https://example.com/v1/metrics' },
      { agent, logger }
    )

    // The exporter (via OTLPMetricExporterBase) forwards `export` to the object
    // passed to `super()`, which is our `NRProxyingDelegate`. That delegate, in
    // turn, calls the innermost network delegate's `export` and passes its result
    // back up. Replace only the innermost network delegate so no HTTP request is
    // made, while exercising the real base class -> NRProxyingDelegate chain.
    const wrappedResult = { code: ExportResultCode.SUCCESS }
    const fakeNetworkDelegate = {
      export(items, callback) {
        callback(wrappedResult)
      }
    }
    exporter._delegate = new NRProxyingDelegate(fakeNetworkDelegate, { agent, logger })
    t.assert.ok(exporter._delegate instanceof NRProxyingDelegate)

    exporter.export([1, 2, 3], (result) => {
    // The result produced by the innermost delegate is the exact object handed
    // to the caller's callback, unchanged, having traveled:
    //   NROTLPMetricExporter.export -> NRProxyingDelegate.export -> network delegate
      t.assert.strictEqual(result, wrappedResult)
      t.assert.equal(result.code, ExportResultCode.SUCCESS)
      done()
    })
  }
)

test(
  'serializedData exposes the last serialization produced by the wrapped serializer',
  async (t) => {
    const { logger } = t.nr
    // Serverless mode makes the serializer cache the payload regardless of
    // audit logging, which is exactly the path the harvest relies on.
    const agent = { ...t.nr.agent, serverlessMode: true }

    const exporter = new NROTLPMetricExporter(
      { url: 'https://example.com/v1/metrics', temporalityPreference: 0 },
      { agent, logger }
    )

    const metrics = await collectResourceMetrics()
    const expected = Buffer.from(
      ProtobufMetricsSerializer.serializeRequest(metrics)
    ).toString('base64')

    // Drive the real delegate -> real NRProxyingSerializer. Serialization runs
    // before the transport send, so the cache is populated even though the HTTP
    // request to example.com never succeeds.
    await new Promise((resolve) => {
      exporter._delegate.export(metrics, () => resolve())
    })

    t.assert.equal(exporter.serializedData, expected)
    // The getter purges after reading, so a second read is empty.
    t.assert.equal(exporter.serializedData, '')
  }
)
