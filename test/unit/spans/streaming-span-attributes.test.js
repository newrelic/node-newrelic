/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')

const StreamingSpanAttributes = require('../../../lib/spans/streaming-span-attributes')

test('addAttribute() should add a valid value', () => {
  const testKey = 'testKey'
  const testValue = 'testValue'
  const expected = {
    [testKey]: {
      string_value: testValue
    }
  }

  const attributes = new StreamingSpanAttributes()
  attributes.addAttribute(testKey, testValue)

  assert.deepEqual(attributes, expected)
})

test('addAttribute() should drp an invalid value', () => {
  const testKey = 'testKey'
  const testValue = {}
  const expected = {} // no attribute added

  const attributes = new StreamingSpanAttributes()
  attributes.addAttribute(testKey, testValue)

  assert.deepEqual(attributes, expected)
})

test('addAttributes() should add all valid values', () => {
  const incomingAttributes = {
    strTest: 'value1',
    boolTest: true,
    intTest: 202,
    doubleTest: 99.99
  }

  const expected = {
    strTest: { string_value: 'value1' },
    boolTest: { bool_value: true },
    intTest: { int_value: 202 },
    doubleTest: { double_value: 99.99 }
  }

  const attributes = new StreamingSpanAttributes()
  attributes.addAttributes(incomingAttributes)

  assert.deepEqual(attributes, expected)
})

test('addAttributes() should drop all invalid values', () => {
  const incomingAttributes = {
    validBool: true,
    validDouble: 99.99,
    invalidStr: null,
    invalidInt: undefined,
    invalidObj: {}
  }

  const expected = {
    validBool: { bool_value: true },
    validDouble: { double_value: 99.99 }
  }

  const attributes = new StreamingSpanAttributes()
  attributes.addAttributes(incomingAttributes)

  assert.deepEqual(attributes, expected)
})

test('constructor should add all valid values', () => {
  const incomingAttributes = {
    strTest: 'value1',
    boolTest: true,
    intTest: 202,
    doubleTest: 99.99
  }

  const expected = {
    strTest: { string_value: 'value1' },
    boolTest: { bool_value: true },
    intTest: { int_value: 202 },
    doubleTest: { double_value: 99.99 }
  }

  const attributes = new StreamingSpanAttributes(incomingAttributes)

  assert.deepEqual(attributes, expected)
})

test('addAttributes() should drop all invalid values', () => {
  const incomingAttributes = {
    validBool: true,
    validDouble: 99.99,
    invalidStr: null,
    invalidInt: undefined,
    invalidObj: {}
  }

  const expected = {
    validBool: { bool_value: true },
    validDouble: { double_value: 99.99 }
  }

  const attributes = new StreamingSpanAttributes(incomingAttributes)

  assert.deepEqual(attributes, expected)
})
