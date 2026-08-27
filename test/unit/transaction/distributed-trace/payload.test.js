/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const {
  Payload,
  PayloadData
} = require('#agentlib/transaction/distributed-trace/payload.js')

// A complete, valid `d` (data) object using the short spec keys.
function makeData(overrides = {}) {
  return {
    ty: 'App',
    ac: 'account-1',
    ap: 'app-1',
    tx: 'tx-1',
    tr: 'trace-1',
    id: 'span-1',
    pr: 1.5,
    sa: true,
    tk: 'trust-1',
    ti: 1482959525577,
    ...overrides
  }
}

test('PayloadData', async (t) => {
  await t.test('exposes values via both short and long getter names', () => {
    const d = new PayloadData(makeData())
    assert.equal(d.ty, 'App')
    assert.equal(d.type, 'App')
    assert.equal(d.ac, 'account-1')
    assert.equal(d.accountId, 'account-1')
    assert.equal(d.ap, 'app-1')
    assert.equal(d.appId, 'app-1')
    assert.equal(d.id, 'span-1')
    assert.equal(d.guid, 'span-1')
    assert.equal(d.tr, 'trace-1')
    assert.equal(d.traceId, 'trace-1')
    assert.equal(d.tx, 'tx-1')
    assert.equal(d.transactionId, 'tx-1')
    assert.equal(d.tk, 'trust-1')
    assert.equal(d.trustKey, 'trust-1')
    assert.equal(d.pr, 1.5)
    assert.equal(d.priority, 1.5)
    assert.equal(d.sa, true)
    assert.equal(d.sampled, true)
    assert.equal(d.ti, 1482959525577)
    assert.equal(d.timestamp, 1482959525577)
  })

  await t.test('throws when a required key is missing', () => {
    for (const key of ['ty', 'ac', 'ap', 'tr', 'ti']) {
      const data = makeData()
      delete data[key]
      assert.throws(() => new PayloadData(data), new RegExp(`Missing required data key: ${key}\\.`))
    }
  })

  await t.test('does not require the optional keys (id, tx, tk, pr, sa)', () => {
    const data = { ty: 'App', ac: 'account-1', ap: 'app-1', tr: 'trace-1', ti: 1 }
    const d = new PayloadData(data)
    assert.equal(d.guid, undefined)
    assert.equal(d.transactionId, undefined)
    assert.equal(d.trustKey, undefined)
  })

  await t.test('returns the same instance when constructed from a PayloadData', () => {
    // Idempotent construction is used so callers can normalize freely.
    const d = new PayloadData(makeData())
    assert.equal(new PayloadData(d), d)
  })

  await t.test('short setters update the corresponding value', () => {
    const d = new PayloadData(makeData())
    d.tr = 'new-trace'
    assert.equal(d.traceId, 'new-trace')
    d.ac = 'new-account'
    assert.equal(d.accountId, 'new-account')
  })

  await t.test('toJSON emits the fixed spec key set', () => {
    const d = new PayloadData(makeData())
    assert.deepStrictEqual(d.toJSON(), {
      ty: 'App',
      ac: 'account-1',
      ap: 'app-1',
      id: 'span-1',
      tr: 'trace-1',
      tk: 'trust-1',
      pr: 1.5,
      sa: true,
      ti: 1482959525577,
      tx: 'tx-1'
    })
  })

  // Documents current behavior, not necessarily desired behavior: the required
  // key check uses Object.hasOwn against the SHORT keys only, so a payload that
  // supplies only long-form keys is rejected even though the getters would read
  // them via the `||` fallback.
  await t.test('rejects input that uses only long-form key names', () => {
    const data = { type: 'App', accountId: 'a', appId: 'b', traceId: 't', timestamp: 1 }
    assert.throws(() => new PayloadData(data), /Missing required data key: ty\./)
  })

  await t.test('preserves falsy-but-valid priority and sampled values', () => {
    const d = new PayloadData(makeData({ pr: 0, sa: false }))
    assert.equal(d.priority, 0)
    assert.equal(d.sampled, false)
  })
})

test('Payload', async (t) => {
  await t.test('throws when no input is provided', () => {
    assert.throws(() => new Payload(), /Missing payload input\./)
    assert.throws(() => new Payload({}), /Missing payload input\./)
  })

  await t.test('parses a plain object input', () => {
    const p = new Payload({ input: { v: [0, 1], d: makeData() } })
    assert.deepStrictEqual(p.version, [0, 1])
    assert.equal(p.major, 0)
    assert.equal(p.minor, 1)
    assert.ok(p.data instanceof PayloadData)
    assert.equal(p.data.traceId, 'trace-1')
  })

  await t.test('parses a JSON string input', () => {
    const p = new Payload({ input: JSON.stringify({ v: [0, 1], d: makeData() }) })
    assert.deepStrictEqual(p.version, [0, 1])
    assert.equal(p.data.type, 'App')
  })

  await t.test('parses a base64-encoded JSON string input', () => {
    const encoded = Buffer.from(JSON.stringify({ v: [0, 1], d: makeData() })).toString('base64')
    const p = new Payload({ input: encoded })
    assert.equal(p.data.accountId, 'account-1')
  })

  await t.test('preserves the major/minor version from the input', () => {
    const p = new Payload({ input: { v: [1, 3], d: makeData() } })
    assert.equal(p.major, 1)
    assert.equal(p.minor, 3)
    assert.deepStrictEqual(p.version, [1, 3])
  })

  await t.test('throws on a missing or malformed version key', () => {
    assert.throws(() => new Payload({ input: { d: makeData() } }), /Missing or invalid version \(v\) key\./)
    assert.throws(() => new Payload({ input: { v: [0], d: makeData() } }), /Missing or invalid version \(v\) key\./)
    assert.throws(() => new Payload({ input: { v: 'nope', d: makeData() } }), /Missing or invalid version \(v\) key\./)
  })

  await t.test('throws when version fields are not numbers', () => {
    assert.throws(() => new Payload({ input: { v: ['0', '1'], d: makeData() } }), /Version fields must be numbers\./)
  })

  await t.test('throws on a missing or invalid data key', () => {
    assert.throws(() => new Payload({ input: { v: [0, 1] } }), /Missing or invalid data \(d\) key\./)
    assert.throws(() => new Payload({ input: { v: [0, 1], d: 'nope' } }), /Missing or invalid data \(d\) key\./)
  })

  await t.test('propagates PayloadData validation errors', () => {
    assert.throws(() => new Payload({ input: { v: [0, 1], d: { ty: 'App' } } }), /Missing required data key: ac\./)
  })

  await t.test('throws on an unparseable string input', () => {
    assert.throws(() => new Payload({ input: '{not valid json' }))
  })

  await t.test('toJSON round-trips through the version and data', () => {
    const p = new Payload({ input: { v: [0, 1], d: makeData() } })
    const json = JSON.parse(JSON.stringify(p))
    assert.deepStrictEqual(json.v, [0, 1])
    assert.equal(json.d.tr, 'trace-1')
    assert.equal(json.d.ty, 'App')
  })

  await t.test('exposes the current supported version as statics', () => {
    assert.equal(Payload.CURRENT_MAJOR, 0)
    assert.equal(Payload.CURRENT_MINOR, 1)
  })
})
