/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const OutgoingPayload = require('#agentlib/transaction/distributed-trace/outgoing-payload.js')
const OutgoingPayloadStub = OutgoingPayload.Stub

function makeData() {
  return {
    ty: 'App',
    ac: '1',
    ap: 'app-id',
    tx: 'tx-id',
    tr: 'trace-id',
    id: 'span-id',
    pr: 1.5,
    sa: true,
    ti: 1482959525577
  }
}

test('OutgoingPayload', async function (t) {
  await t.test('text() returns the stringified {v, d} payload', function () {
    const data = makeData()
    const dt = new OutgoingPayload(data)
    const output = JSON.parse(dt.text())

    assert.deepStrictEqual(output.v, [0, 1])
    assert.deepStrictEqual(output.d, {
      ty: 'App',
      ac: '1',
      ap: 'app-id',
      id: 'span-id',
      tr: 'trace-id',
      pr: 1.5,
      sa: true,
      ti: 1482959525577,
      tx: 'tx-id'
    })
  })

  await t.test('httpSafe() returns the base64 encoded payload', function () {
    const data = makeData()
    const dt = new OutgoingPayload(data)
    const output = JSON.parse(Buffer.from(dt.httpSafe(), 'base64').toString('utf-8'))

    assert.deepStrictEqual(output.v, [0, 1])
    assert.equal(output.d.tr, 'trace-id')
    assert.equal(output.d.ty, 'App')
  })

  await t.test('httpSafe() memoizes the encoded payload', function () {
    const dt = new OutgoingPayload(makeData())
    assert.equal(dt.httpSafe(), dt.httpSafe())
  })

  await t.test('throws when the data object is missing required keys', function () {
    assert.throws(() => new OutgoingPayload({ a: 1, b: 'test' }), /Missing required data key/)
  })
})

test('OutgoingPayloadStub', async function (t) {
  await t.test('httpSafe() returns an empty string', function () {
    const dt = new OutgoingPayloadStub()
    assert.equal(dt.httpSafe(), '')
  })

  await t.test('text() returns an empty string', function () {
    const dt = new OutgoingPayloadStub()
    assert.equal(dt.text(), '')
  })
})
