'use strict'

const tap = require('tap')

const mapValueToStreamingTypeValue = require('../../../lib/spans/mapValueToStreamingTypeValue')

tap.test('should corectly convert strings', (t) => {
  const stringValue = 'myString'
  const expected = {
    'string_value': stringValue
  }

  const result = mapValueToStreamingTypeValue(stringValue)
  t.deepEqual(result, expected)
  t.end()
})

tap.test('should not drop empty strings', (t) => {
  const stringValue = ''
  const expected = {
    'string_value': stringValue
  }

  const result = mapValueToStreamingTypeValue(stringValue)
  t.deepEqual(result, expected)
  t.end()
})

tap.test('should correctly convert bools when true', (t) => {
  const boolValue = true
  const expected = {
    'bool_value': boolValue
  }

  const result = mapValueToStreamingTypeValue(boolValue)
  t.deepEqual(result, expected)
  t.end()
})

tap.test('should correctly convert bools when false', (t) => {
  const boolValue = false
  const expected = {
    'bool_value': boolValue
  }

  const result = mapValueToStreamingTypeValue(boolValue)
  t.deepEqual(result, expected)
  t.end()
})

tap.test('should correctly convert integers', (t) => {
  const intValue = 9999999999999999
  const expected = {
    'int_value': intValue
  }

  const result = mapValueToStreamingTypeValue(intValue)
  t.deepEqual(result, expected)
  t.end()
})

tap.test('should correctly convert doubles', (t) => {
  const doubleValue = 999.99
  const expected = {
    'double_value': doubleValue
  }

  const result = mapValueToStreamingTypeValue(doubleValue)
  t.deepEqual(result, expected)
  t.end()
})

tap.test('should drop nulls', (t) => {
  const result = mapValueToStreamingTypeValue(null)

  t.equal(result, undefined)
  t.end()
})

tap.test('should drop undefined', (t) => {
  const result = mapValueToStreamingTypeValue()

  t.equal(result, undefined)
  t.end()
})

tap.test('should drop objects', (t) => {
  const result = mapValueToStreamingTypeValue({})

  t.equal(result, undefined)
  t.end()
})

tap.test('should drop functions', (t) => {
  const result = mapValueToStreamingTypeValue(() => {})

  t.equal(result, undefined)
  t.end()
})
