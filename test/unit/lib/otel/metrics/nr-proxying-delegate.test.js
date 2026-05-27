/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const NRProxyingDelegate = require('#agentlib/otel/metrics/nr-proxying-delegate.js')

test.beforeEach((ctx) => {
  ctx.nr = {
    logs: []
  }

  ctx.nr.logger = {
    auditEnabled() { return true },
    audit(...args) { ctx.nr.logs.push(args) },
    child() { return this }
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

  ctx.nr.delegate = new NRProxyingDelegate(mockDelegate, ctx.nr.logger)
})

test('logs during export', (t) => {
  t.plan(2)
  const { delegate } = t.nr

  delegate.export([1, 2, 3], (result) => {
    t.assert.deepEqual(result, { code: 0 })
    t.assert.deepEqual(t.nr.logs[0], [
      'Received metrics export result code: %s',
      0
    ])
  })
})

test('appease coverage bot', (t) => {
  t.plan(2)
  const { delegate } = t.nr
  t.assert.equal('flushed', delegate.forceFlush())
  t.assert.equal('stopped', delegate.shutdown())
})
