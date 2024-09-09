/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const zlib = require('zlib')
const codec = require('../../../lib/util/codec')
const DATA = { foo: 'bar' }
const ENCODED = 'eJyrVkrLz1eyUkpKLFKqBQAdegQ0'

test('codec', async function (t) {
  await t.test('.encode should zip and base-64 encode the data', function (t, end) {
    codec.encode(DATA, function (err, encoded) {
      assert.equal(err, null)
      assert.equal(encoded, ENCODED)
      end()
    })
  })

  await t.test('.encode should not error for circular payloads', function (t, end) {
    const val = '{"foo":"bar","obj":"[Circular ~]"}'
    const obj = { foo: 'bar' }
    obj.obj = obj

    codec.encode(obj, function (err, encoded) {
      assert.equal(err, null)
      const decoded = zlib.inflateSync(Buffer.from(encoded, 'base64')).toString()
      assert.equal(decoded, val)
      end()
    })
  })

  await t.test('.decode should parse the encoded payload', function (t, end) {
    codec.decode(ENCODED, function (err, data) {
      assert.equal(err, null)
      assert.deepEqual(data, DATA)
      end()
    })
  })

  await t.test('.encodeSync should zip and base-64 encode the data', function () {
    const encoded = codec.encodeSync(DATA)
    assert.equal(encoded, ENCODED)
  })

  await t.test('.decodeSync should parse the encoded payload', function () {
    const data = codec.decodeSync(ENCODED)
    assert.deepEqual(data, DATA)
  })
})
