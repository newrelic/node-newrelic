/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { test } = require('tap')
const codec = require('../../../lib/util/codec')
const DATA = { foo: 'bar' }
const ENCODED = 'eJyrVkrLz1eyUkpKLFKqBQAdegQ0'

test('codec', function (t) {
  t.autoend()
  t.test('.encode', function (t) {
    t.autoend()
    t.test('should zip and base-64 encode the data', function (t) {
      codec.encode(DATA, function (err, encoded) {
        t.error(err)
        t.equal(encoded, ENCODED)
        t.end()
      })
    })

    t.test('should not error for circular payloads', function (t) {
      const val = 'eJyrVkrLz1eyUkpKLFLSUcpPygKyo50zi5JLcxKLFOpilWoBuCkK6A=='
      const obj = { foo: 'bar' }
      obj.obj = obj

      codec.encode(obj, function (err, encoded) {
        t.error(err)
        t.equal(encoded, val)
        t.end()
      })
    })
  })

  t.test('.decode should parse the encoded payload', function (t) {
    codec.decode(ENCODED, function (err, data) {
      t.error(err)
      t.same(data, DATA)
      t.end()
    })
  })

  t.test('.encodeSync should zip and base-64 encode the data', function (t) {
    const encoded = codec.encodeSync(DATA)
    t.equal(encoded, ENCODED)
    t.end()
  })

  t.test('.decodeSync should parse the encoded payload', function (t) {
    const data = codec.decodeSync(ENCODED)
    t.same(data, DATA)
    t.end()
  })
})
