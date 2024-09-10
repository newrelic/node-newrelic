/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')

const mapToStreamingType = require('../../../lib/spans/map-to-streaming-type')

test('should corectly convert strings', async () => {
  const stringValue = 'myString'
  const expected = {
    string_value: stringValue
  }
  const result = mapToStreamingType(stringValue)
  assert.deepEqual(result, expected)
})

test('should not drop empty strings', async () => {
  const stringValue = ''
  const expected = {
    string_value: stringValue
  }
  const result = mapToStreamingType(stringValue)
  assert.deepEqual(result, expected)
})

test('should correctly convert bools when true', async () => {
  const boolValue = true
  const expected = {
    bool_value: boolValue
  }
  const result = mapToStreamingType(boolValue)
  assert.deepEqual(result, expected)
})

test('should correctly convert bools when false', async () => {
  const boolValue = false
  const expected = {
    bool_value: boolValue
  }
  const result = mapToStreamingType(boolValue)
  assert.deepEqual(result, expected)
})

test('should correctly convert integers', async () => {
  const intValue = 9999999999999999
  const expected = {
    int_value: intValue
  }
  const result = mapToStreamingType(intValue)
  assert.deepEqual(result, expected)
})

test('should correctly convert doubles', async () => {
  const doubleValue = 999.99
  const expected = {
    double_value: doubleValue
  }
  const result = mapToStreamingType(doubleValue)
  assert.deepEqual(result, expected)
})

test('should drop nulls', async () => {
  const result = mapToStreamingType(null)
  assert.equal(result, undefined)
})

test('should drop undefined', async () => {
  const result = mapToStreamingType()
  assert.equal(result, undefined)
})

test('should drop objects', async () => {
  const result = mapToStreamingType({})
  assert.equal(result, undefined)
})

test('should drop functions', async () => {
  const result = mapToStreamingType(() => {})
  assert.equal(result, undefined)
})
