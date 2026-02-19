/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { Exception } = require('#agentlib/errors/index.js')

test('should create Exception with basic error', () => {
  const error = Error('test error')
  const exception = new Exception({ error })

  assert.equal(exception.error, error)
  assert.equal(exception.timestamp, 0)
  assert.deepEqual(exception.customAttributes, {})
  assert.deepEqual(exception.agentAttributes, {})
  assert.equal(exception._expected, undefined)
  assert.equal(exception.errorGroupCallback, null)
})

test('should create Exception with all options', () => {
  const error = Error('test error')
  const timestamp = Date.now()
  const customAttributes = { foo: 'bar' }
  const agentAttributes = { agent: 'attribute' }
  const expected = true

  const exception = new Exception({
    error,
    timestamp,
    customAttributes,
    agentAttributes,
    expected
  })

  assert.equal(exception.error, error)
  assert.equal(exception.timestamp, timestamp)
  assert.deepEqual(exception.customAttributes, customAttributes)
  assert.deepEqual(exception.agentAttributes, agentAttributes)
  assert.equal(exception._expected, expected)
})

test('should not add error.cause attribute when error has no cause', () => {
  const error = Error('test error')
  const exception = new Exception({ error })

  assert.equal(exception.agentAttributes['error.cause'], undefined)
})

test('should serialize string cause', () => {
  const error = Error('test error')
  error.cause = 'string cause'
  const exception = new Exception({ error })

  assert.equal(typeof exception.agentAttributes['error.cause'], 'string')
  const parsed = JSON.parse(exception.agentAttributes['error.cause'])
  assert.deepEqual(parsed, [{ message: 'string cause' }])
})

test('should serialize Error object cause', () => {
  const causeError = Error('cause error')
  const error = Error('test error')
  error.cause = causeError

  const exception = new Exception({ error })

  assert.equal(typeof exception.agentAttributes['error.cause'], 'string')
  const parsed = JSON.parse(exception.agentAttributes['error.cause'])
  assert.ok(Array.isArray(parsed))
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].message, 'cause error')
  assert.ok(parsed[0].stack)
  assert.deepEqual(parsed[0].cause, [])
})

test('should serialize nested/chained error causes', () => {
  const rootCause = Error('root cause')
  const middleCause = Error('middle cause')
  middleCause.cause = rootCause
  const error = Error('top error')
  error.cause = middleCause

  const exception = new Exception({ error })

  assert.equal(typeof exception.agentAttributes['error.cause'], 'string')
  const parsed = JSON.parse(exception.agentAttributes['error.cause'])
  assert.ok(Array.isArray(parsed))
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].message, 'middle cause')
  assert.ok(parsed[0].stack)
  assert.ok(Array.isArray(parsed[0].cause))
  assert.equal(parsed[0].cause.length, 1)
  assert.equal(parsed[0].cause[0].message, 'root cause')
  assert.ok(parsed[0].cause[0].stack)
  assert.deepEqual(parsed[0].cause[0].cause, [])
})

test('should handle cause that is not an Error instance', () => {
  const error = Error('test error')
  error.cause = { foo: 'bar' }

  const exception = new Exception({ error })

  assert.equal(typeof exception.agentAttributes['error.cause'], 'string')
  const parsed = JSON.parse(exception.agentAttributes['error.cause'])
  assert.deepEqual(parsed, [{ message: 'cause does not look like an Error instance' }])
})

test('should handle cause object with only message (no stack)', () => {
  const error = Error('test error')
  error.cause = { message: 'has message but no stack' }

  const exception = new Exception({ error })

  assert.equal(typeof exception.agentAttributes['error.cause'], 'string')
  const parsed = JSON.parse(exception.agentAttributes['error.cause'])
  assert.deepEqual(parsed, [{ message: 'has message but no stack' }])
})

test('should handle cause object with only stack (no message)', () => {
  const error = Error('test error')
  error.cause = { stack: 'has stack but no message' }

  const exception = new Exception({ error })

  assert.equal(typeof exception.agentAttributes['error.cause'], 'string')
  const parsed = JSON.parse(exception.agentAttributes['error.cause'])
  assert.deepEqual(parsed, [{ message: 'cause does not look like an Error instance' }])
})

test('should merge custom agentAttributes with error.cause', () => {
  const causeError = Error('cause error')
  const error = Error('test error')
  error.cause = causeError

  const agentAttributes = { custom: 'value' }
  const exception = new Exception({ error, agentAttributes })

  assert.equal(exception.agentAttributes.custom, 'value')
  assert.ok(exception.agentAttributes['error.cause'])
  assert.equal(typeof exception.agentAttributes['error.cause'], 'string')
  const parsed = JSON.parse(exception.agentAttributes['error.cause'])
  assert.equal(parsed[0].message, 'cause error')
})

test('should handle string cause in nested chain', () => {
  const middleCause = Error('middle error')
  middleCause.cause = 'string at end'
  const error = Error('top error')
  error.cause = middleCause

  const exception = new Exception({ error })

  assert.equal(typeof exception.agentAttributes['error.cause'], 'string')
  const parsed = JSON.parse(exception.agentAttributes['error.cause'])
  assert.equal(parsed[0].message, 'middle error')
  assert.ok(Array.isArray(parsed[0].cause))
  assert.equal(parsed[0].cause.length, 1)
  assert.deepEqual(parsed[0].cause[0], { message: 'string at end' })
})

test('should handle null cause', () => {
  const error = Error('test error')
  error.cause = null

  const exception = new Exception({ error })

  assert.equal(typeof exception.agentAttributes['error.cause'], 'string')
  const parsed = JSON.parse(exception.agentAttributes['error.cause'])
  assert.deepEqual(parsed, [])
})

test('should handle undefined cause explicitly set', () => {
  const error = Error('test error')
  error.cause = undefined

  const exception = new Exception({ error })

  assert.equal(typeof exception.agentAttributes['error.cause'], 'string')
  const parsed = JSON.parse(exception.agentAttributes['error.cause'])
  assert.deepEqual(parsed, [])
})
