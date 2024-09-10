/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const { isSimpleObject, isNotEmpty } = require('../../../lib/util/objects')
const fixtures = [
  { name: 'populated object', value: { a: 1, b: 2, c: 3 }, simple: true, nonEmpty: true },
  { name: 'empty object', value: {}, simple: true, nonEmpty: false },
  { name: 'object', value: { key: 'value' }, simple: true, nonEmpty: true },
  { name: 'null', value: null, simple: false, nonEmpty: false },
  { name: 'undefined', value: undefined, simple: false, nonEmpty: false },
  { name: 'array', value: [1, 2, 3, 4], simple: false, nonEmpty: false },
  { name: 'empty array', value: [], simple: false, nonEmpty: false },
  { name: 'string', value: 'a string', simple: false, nonEmpty: false },
  { name: 'empty string', value: '', simple: false, nonEmpty: false },
  { name: 'number', value: 42, simple: false, nonEmpty: false },
  { name: 'zero', value: 0, simple: false, nonEmpty: false },
  { name: 'boolean true', value: true, simple: false, nonEmpty: false },
  { name: 'boolean false', value: false, simple: false, nonEmpty: false },
  { name: 'function', value: () => true, simple: false, nonEmpty: false },
  { name: 'function with false return', value: () => false, simple: false, nonEmpty: false }
]

test('isSimpleObject should distinguish objects from non-objects', () => {
  fixtures.forEach((f) => {
    const testValue = isSimpleObject(f.value)
    assert.equal(testValue, f.simple, `should be able to test ${f.name} correctly`)
  })
})

test('isNotEmpty should discern non-empty objects from empty objects and other entities', () => {
  fixtures.forEach((f) => {
    const testValue = isNotEmpty(f.value)
    assert.equal(testValue, f.nonEmpty, `should be able to test ${f.name} correctly`)
  })
})
