/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const { isSimpleObject, isNotEmpty } = require('../../../lib/util/objects')
const fixtures = [
  { name: 'populated object', value: { a: 1, b: 2, c: 3 }, simple: true, nonEmpty: true },
  { name: 'empty object', value: {}, simple: true, nonEmpty: false },
  { name: 'null', value: null, simple: false, nonEmpty: false },
  { name: 'undefined', value: undefined, simple: false, nonEmpty: false },
  { name: 'array', value: [1, 2, 3, 4], simple: true, nonEmpty: true },
  { name: 'empty array', value: [], simple: true, nonEmpty: false },
  { name: 'string', value: 'a string', simple: false, nonEmpty: false },
  { name: 'empty string', value: '', simple: false, nonEmpty: false },
  { name: 'number', value: 42, simple: false, nonEmpty: false },
  { name: 'zero', value: 0, simple: false, nonEmpty: false },
  { name: 'boolean true', value: true, simple: false, nonEmpty: false },
  { name: 'boolean false', value: false, simple: false, nonEmpty: false },
  { name: 'function', value: () => true, simple: false, nonEmpty: false },
  { name: 'function with false return', value: () => false, simple: false, nonEmpty: false }
]

tap.test('isSimpleObject', (t) => {
  t.test('should distinguish objects from non-objects', (t) => {
    fixtures.forEach((f) => {
      try {
        const testValue = isSimpleObject(f.value)
        t.equal(testValue, f.simple, `should be able to test ${f.name} correctly`)
      } catch (e) {
        t.notOk(e, `should be able to handle ${f.name} without error`)
      }
    })
    t.end()
  })
  t.end()
})
tap.test('isNotEmpty', (t) => {
  t.test('should discern non-empty objects from empty objects and other entities', (t) => {
    fixtures.forEach((f) => {
      try {
        const testValue = isNotEmpty(f.value)
        t.equal(testValue, f.nonEmpty, `should be able to test ${f.name} correctly`)
      } catch (e) {
        t.notOk(e, `should be able to handle ${f.name} without error`)
      }
    })
    t.end()
  })
  t.end()
})
