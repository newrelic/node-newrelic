/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const StreamingSpanAttributes = require('../../../lib/spans/streaming-span-attributes')

tap.test('addAttribute() should add a valid value', (t) => {
  const testKey = 'testKey'
  const testValue = 'testValue'
  const expected = {
    [testKey]: {
      string_value: testValue
    }
  }

  const attributes = new StreamingSpanAttributes()
  attributes.addAttribute(testKey, testValue)

  t.same(attributes, expected)
  t.end()
})

tap.test('addAttribute() should drp an invalid value', (t) => {
  const testKey = 'testKey'
  const testValue = {}
  const expected = {} // no attribute added

  const attributes = new StreamingSpanAttributes()
  attributes.addAttribute(testKey, testValue)

  t.same(attributes, expected)
  t.end()
})

tap.test('addAttributes() should add all valid values', (t) => {
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

  t.same(attributes, expected)
  t.end()
})

tap.test('addAttributes() should drop all invalid values', (t) => {
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

  t.same(attributes, expected)
  t.end()
})

tap.test('constructor should add all valid values', (t) => {
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

  t.same(attributes, expected)
  t.end()
})

tap.test('addAttributes() should drop all invalid values', (t) => {
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

  t.same(attributes, expected)
  t.end()
})
