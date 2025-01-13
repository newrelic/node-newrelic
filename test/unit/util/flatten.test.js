/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const flatten = require('../../../lib/util/flatten')

test('util.flatten', async (t) => {
  await t.test('flattens things', () => {
    assert.deepStrictEqual(flatten({}, '', { a: 5, b: true }), { a: 5, b: true }, '1 level')
    assert.deepStrictEqual(
      flatten({}, '', { a: 5, b: { c: true, d: 7 } }),
      { a: 5, 'b.c': true, 'b.d': 7 },
      '2 levels'
    )
    assert.deepStrictEqual(
      flatten({}, '', { a: 5, b: { c: true, d: 7, e: { foo: 'efoo', bar: 'ebar' } } }),
      { a: 5, 'b.c': true, 'b.d': 7, 'b.e.foo': 'efoo', 'b.e.bar': 'ebar' },
      '3 levels'
    )
  })

  await t.test('flattens recursive objects', () => {
    const obj = {}
    obj.x = obj
    assert.deepStrictEqual(flatten({}, '', obj), {})
  })
})

test('util.flatten.keys', async (t) => {
  await t.test('gets flattened keys', () => {
    assert.deepStrictEqual(flatten.keys({ a: 5, b: true }), ['a', 'b'], '1 level')
    assert.deepStrictEqual(
      flatten.keys({ a: 5, b: { c: true, d: 7 } }),
      ['a', 'b.c', 'b.d'],
      '2 levels'
    )
    assert.deepStrictEqual(
      flatten.keys({ a: 5, b: { c: true, d: 7, e: { foo: 'efoo', bar: 'ebar' } } }),
      ['a', 'b.c', 'b.d', 'b.e.foo', 'b.e.bar'],
      '3 levels'
    )
  })

  await t.test('flattens recursive objects', () => {
    const obj = {}
    obj.x = obj
    assert.deepStrictEqual(flatten.keys(obj), [])
  })
})
