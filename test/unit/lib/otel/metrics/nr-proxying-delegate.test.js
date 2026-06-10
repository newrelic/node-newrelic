/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { ExportResultCode } = require('@opentelemetry/core')
const NRProxyingDelegate = require('#agentlib/otel/metrics/nr-proxying-delegate.js')

test.beforeEach((ctx) => {
  ctx.nr = {
    logs: [],
    metricsRecorded: []
  }

  ctx.nr.logger = {
    auditEnabled() { return true },
    audit(...args) { ctx.nr.logs.push(args) },
    child() { return this }
  }

  ctx.nr.agent = {
    metrics: {
      getOrCreateMetric(name) {
        ctx.nr.metricsRecorded.push(name)
        return {
          incrementCallCount() {}
        }
      }
    }
  }

  const mockDelegate = {
    export(items, callback) {
      callback({ code: 0 })
    },
    forceFlush() {
      return 'flushed'
    },
    shutdown() {
      return 'stopped'
    }
  }

  ctx.nr.delegate = new NRProxyingDelegate(mockDelegate, {
    agent: ctx.nr.agent,
    logger: ctx.nr.logger
  })
  ctx.nr.mockDelegate = mockDelegate
})

test('logs during export and records success metric', (t) => {
  t.plan(3)
  const { delegate } = t.nr

  delegate.export([1, 2, 3], (result) => {
    t.assert.deepEqual(result, { code: 0 })
    t.assert.deepEqual(t.nr.logs[0], [
      'Received metrics export result code: %s',
      0
    ])
    t.assert.deepEqual(t.nr.metricsRecorded, [
      'Supportability/Metrics/Nodejs/OpenTelemetryBridge/export/success'
    ])
  })
})

test('records success metric when export succeeds', (t) => {
  t.plan(2)
  const { delegate, mockDelegate } = t.nr

  mockDelegate.export = (items, callback) => {
    callback({ code: ExportResultCode.SUCCESS })
  }

  delegate.export([1, 2, 3], (result) => {
    t.assert.equal(result.code, ExportResultCode.SUCCESS)
    t.assert.deepEqual(t.nr.metricsRecorded, [
      'Supportability/Metrics/Nodejs/OpenTelemetryBridge/export/success'
    ])
  })
})

test('records failure metric when export fails', (t) => {
  t.plan(2)
  const { delegate, mockDelegate } = t.nr

  mockDelegate.export = (items, callback) => {
    callback({ code: ExportResultCode.FAILED })
  }

  delegate.export([1, 2, 3], (result) => {
    t.assert.equal(result.code, ExportResultCode.FAILED)
    t.assert.deepEqual(t.nr.metricsRecorded, [
      'Supportability/Metrics/Nodejs/OpenTelemetryBridge/export/failure'
    ])
  })
})

test('does not record metric for unknown result codes', (t) => {
  t.plan(2)
  const { delegate, mockDelegate } = t.nr

  // Use a code that's not SUCCESS or FAILED (e.g., undefined or other value)
  mockDelegate.export = (items, callback) => {
    callback({ code: 999 })
  }

  delegate.export([1, 2, 3], (result) => {
    t.assert.equal(result.code, 999)
    t.assert.deepEqual(t.nr.metricsRecorded, [])
  })
})

test('appease coverage bot', (t) => {
  t.plan(2)
  const { delegate } = t.nr
  t.assert.equal('flushed', delegate.forceFlush())
  t.assert.equal('stopped', delegate.shutdown())
})
