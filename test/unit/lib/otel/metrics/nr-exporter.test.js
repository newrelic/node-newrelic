/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { ExportResultCode } = require('@opentelemetry/core')

const NROTLPMetricExporter = require('#agentlib/otel/metrics/nr-exporter.js')
const NRProxyingDelegate = require('#agentlib/otel/metrics/nr-proxying-delegate.js')

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
