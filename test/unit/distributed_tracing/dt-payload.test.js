/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const DistributedTracePayload = require('../../../lib/transaction/dt-payload')
const DistributedTracePayloadStub = DistributedTracePayload.Stub

test('DistributedTracePayload', async function (t) {
  await t.test('has a text method that returns the stringified payload', function () {
    const payload = {
      a: 1,
      b: 'test'
    }
    const dt = new DistributedTracePayload(payload)
    const output = JSON.parse(dt.text())
    assert.ok(Array.isArray(output.v))
    assert.deepStrictEqual(output.d, payload)
  })

  await t.test('has a httpSafe method that returns the base64 encoded payload', function () {
    const payload = {
      a: 1,
      b: 'test'
    }
    const dt = new DistributedTracePayload(payload)
    const output = JSON.parse(Buffer.from(dt.httpSafe(), 'base64').toString('utf-8'))
    assert.ok(Array.isArray(output.v))
    assert.deepStrictEqual(output.d, payload)
  })
})

test('DistributedTracePayloadStub', async function (t) {
  await t.test('has a httpSafe method that returns an empty string', function () {
    const payload = {
      a: 1,
      b: 'test'
    }
    const dt = new DistributedTracePayloadStub(payload)
    assert.equal(dt.httpSafe(), '')
  })

  await t.test('has a text method that returns an empty string', function () {
    const payload = {
      a: 1,
      b: 'test'
    }
    const dt = new DistributedTracePayloadStub(payload)
    assert.equal(dt.text(), '')
  })
})
