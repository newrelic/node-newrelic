/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const DistributedTracePayload = require('../../../lib/transaction/dt-payload')
const DistributedTracePayloadStub = DistributedTracePayload.Stub

tap.test('DistributedTracePayload', function (t) {
  t.test('has a text method that returns the stringified payload', function (t) {
    const payload = {
      a: 1,
      b: 'test'
    }
    const dt = new DistributedTracePayload(payload)
    const output = JSON.parse(dt.text())
    t.ok(Array.isArray(output.v))
    t.same(output.d, payload)
    t.end()
  })

  t.test('has a httpSafe method that returns the base64 encoded payload', function (t) {
    const payload = {
      a: 1,
      b: 'test'
    }
    const dt = new DistributedTracePayload(payload)
    const output = JSON.parse(Buffer.from(dt.httpSafe(), 'base64').toString('utf-8'))
    t.ok(Array.isArray(output.v))
    t.same(output.d, payload)
    t.end()
  })
  t.end()
})

tap.test('DistributedTracePayloadStub', function (t) {
  t.test('has a httpSafe method that returns an empty string', function (t) {
    const payload = {
      a: 1,
      b: 'test'
    }
    const dt = new DistributedTracePayloadStub(payload)
    t.equal(dt.httpSafe(), '')
    t.end()
  })

  t.test('has a text method that returns an empty string', function (t) {
    const payload = {
      a: 1,
      b: 'test'
    }
    const dt = new DistributedTracePayloadStub(payload)
    t.equal(dt.text(), '')
    t.end()
  })
  t.end()
})
