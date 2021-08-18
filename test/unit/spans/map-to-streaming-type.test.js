/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const mapToStreamingType = require('../../../lib/spans/map-to-streaming-type')

tap.test('should corectly convert strings', (t) => {
  const stringValue = 'myString'
  const expected = {
    string_value: stringValue
  }

  const result = mapToStreamingType(stringValue)
  t.same(result, expected)
  t.end()
})

tap.test('should not drop empty strings', (t) => {
  const stringValue = ''
  const expected = {
    string_value: stringValue
  }

  const result = mapToStreamingType(stringValue)
  t.same(result, expected)
  t.end()
})

tap.test('should correctly convert bools when true', (t) => {
  const boolValue = true
  const expected = {
    bool_value: boolValue
  }

  const result = mapToStreamingType(boolValue)
  t.same(result, expected)
  t.end()
})

tap.test('should correctly convert bools when false', (t) => {
  const boolValue = false
  const expected = {
    bool_value: boolValue
  }

  const result = mapToStreamingType(boolValue)
  t.same(result, expected)
  t.end()
})

tap.test('should correctly convert integers', (t) => {
  const intValue = 9999999999999999
  const expected = {
    int_value: intValue
  }

  const result = mapToStreamingType(intValue)
  t.same(result, expected)
  t.end()
})

tap.test('should correctly convert doubles', (t) => {
  const doubleValue = 999.99
  const expected = {
    double_value: doubleValue
  }

  const result = mapToStreamingType(doubleValue)
  t.same(result, expected)
  t.end()
})

tap.test('should drop nulls', (t) => {
  const result = mapToStreamingType(null)

  t.equal(result, undefined)
  t.end()
})

tap.test('should drop undefined', (t) => {
  const result = mapToStreamingType()

  t.equal(result, undefined)
  t.end()
})

tap.test('should drop objects', (t) => {
  const result = mapToStreamingType({})

  t.equal(result, undefined)
  t.end()
})

tap.test('should drop functions', (t) => {
  const result = mapToStreamingType(() => {})

  t.equal(result, undefined)
  t.end()
})
