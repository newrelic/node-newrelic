/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { EventEmitter } = require('node:events')
const otelApi = require('@opentelemetry/api')

const SetupMetrics = require('#agentlib/otel/metrics/index.js')

// This lives in its own file because `flushToString` registers a global
// (process-wide, first-wins) meter provider. Isolating it keeps that global
// state from colliding with the standard bootstrap flow exercised in
// index.test.js. In serverless mode the exporter is the in-memory
// NRCapturingExporter, so no network access is involved.

test.beforeEach((ctx) => {
  ctx.nr = {}

  const agent = {
    get [Symbol.toStringTag]() { return 'Agent' },
    serverlessMode: true,
    config: {
      otlp_resource_attributes: {},
      entity_guid: 'guid-123456',
      license_key: 'license-123456',
      host: 'example.com',
      port: 443,
      opentelemetry: {
        metrics: {
          enabled: true,
          export_interval: 1_000,
          export_timeout: 100
        }
      }
    },
    metrics: {
      getOrCreateMetric() { return this },
      incrementCallCount() {}
    }
  }
  Object.setPrototypeOf(agent, EventEmitter.prototype)
  ctx.nr.agent = agent
})

test.afterEach(() => {
  // Reset the global meter provider so the next test's SetupMetrics wins the
  // first-come global registration.
  otelApi.metrics.disable()
})

test('flushToString collects, exports, and returns the base64 OTLP payload', async (t) => {
  const { agent } = t.nr

  const signal = new SetupMetrics({ agent })

  const provider = otelApi.metrics.getMeterProvider()
  provider.getMeter('test-meter').createCounter('test-counter').add(1, { foo: 'bar' })

  const found = await signal.flushToString()

  t.assert.equal(typeof found, 'string')
  t.assert.ok(found.length > 0, 'should return a non-empty payload')

  // The payload is base64-encoded OTLP protobuf. Protobuf encodes string fields
  // (metric names, attribute keys) as literal UTF-8, so the recorded counter and
  // its attribute survive into the decoded bytes -- confirming real metrics were
  // serialized rather than an empty envelope.
  const decoded = Buffer.from(found, 'base64').toString('utf8')
  t.assert.match(decoded, /test-counter/, 'payload should carry the recorded counter name')
  t.assert.match(decoded, /foo/, 'payload should carry the recorded attribute key')
})
