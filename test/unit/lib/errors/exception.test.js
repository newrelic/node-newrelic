/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')

const { createError, Exception } = require('#agentlib/errors/index.js')
const helper = require('#testlib/agent_helper.js')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should create Exception with basic error', (t) => {
  const error = Error('test error')
  const exception = new Exception({ error })

  t.assert.equal(exception.error, error)
  t.assert.equal(exception.timestamp, 0)
  t.assert.deepEqual(exception.customAttributes, {})
  t.assert.deepEqual(exception.agentAttributes, {})
  t.assert.equal(exception._expected, undefined)
  t.assert.equal(exception.errorGroupCallback, null)
})

test('should create Exception with all options', (t) => {
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

  t.assert.equal(exception.error, error)
  t.assert.equal(exception.timestamp, timestamp)
  t.assert.deepEqual(exception.customAttributes, customAttributes)
  t.assert.deepEqual(exception.agentAttributes, agentAttributes)
  t.assert.equal(exception._expected, expected)
})

test('should not add error.cause attribute when error has no cause', (t) => {
  t.plan(1)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const error = Error('test error')
    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(params.agentAttributes['error.cause'], undefined)
  })
})

test('should serialize string cause', (t) => {
  t.plan(2)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const error = Error('test error')
    error.cause = 'string cause'
    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.deepEqual(parsed, [{ message: 'string cause' }])
  })
})

test('should serialize Error object cause', (t) => {
  t.plan(6)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const causeError = Error('cause error')
    const error = Error('test error')
    error.cause = causeError

    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.ok(Array.isArray(parsed))
    t.assert.equal(parsed.length, 1)
    t.assert.equal(parsed[0].message, 'cause error')
    t.assert.ok(parsed[0].stack)
    t.assert.deepEqual(parsed[0].cause, [])
  })
})

test('should serialize nested/chained error causes', (t) => {
  t.plan(10)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const rootCause = Error('root cause')
    const middleCause = Error('middle cause')
    middleCause.cause = rootCause
    const error = Error('top error')
    error.cause = middleCause

    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.ok(Array.isArray(parsed))
    t.assert.equal(parsed.length, 1)
    t.assert.equal(parsed[0].message, 'middle cause')
    t.assert.ok(parsed[0].stack)
    t.assert.ok(Array.isArray(parsed[0].cause))
    t.assert.equal(parsed[0].cause.length, 1)
    t.assert.equal(parsed[0].cause[0].message, 'root cause')
    t.assert.ok(parsed[0].cause[0].stack)
    t.assert.deepEqual(parsed[0].cause[0].cause, [])
  })
})

test('should handle object cause that is not an Error instance', (t) => {
  t.plan(2)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const error = Error('test error')
    error.cause = { foo: 'bar' }

    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.deepEqual(parsed, [{ message: 'cause does not look like an Error instance' }])
  })
})

test('should handle cause object with only message (no stack)', (t) => {
  t.plan(2)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const error = Error('test error')
    error.cause = { message: 'has message but no stack' }

    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.deepEqual(parsed, [{ message: 'has message but no stack' }])
  })
})

test('should handle cause object with only stack (no message)', (t) => {
  t.plan(2)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const error = Error('test error')
    error.cause = { stack: 'has stack but no message' }

    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.deepEqual(parsed, [{ message: 'cause does not look like an Error instance' }])
  })
})

test('should merge custom agentAttributes with error.cause', (t) => {
  t.plan(4)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const causeError = Error('cause error')
    const error = Error('test error')
    error.cause = causeError

    const agentAttributes = { custom: 'value' }
    const exception = new Exception({ error, agentAttributes })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(params.agentAttributes.custom, 'value')
    t.assert.ok(params.agentAttributes['error.cause'])
    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.equal(parsed[0].message, 'cause error')
  })
})

test('should handle string cause in nested chain', (t) => {
  t.plan(5)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const middleCause = Error('middle error')
    middleCause.cause = 'string at end'
    const error = Error('top error')
    error.cause = middleCause

    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.equal(parsed[0].message, 'middle error')
    t.assert.ok(Array.isArray(parsed[0].cause))
    t.assert.equal(parsed[0].cause.length, 1)
    t.assert.deepEqual(parsed[0].cause[0], { message: 'string at end' })
  })
})

test('should handle null cause', (t) => {
  t.plan(2)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const error = Error('test error')
    error.cause = null

    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.deepEqual(parsed, [])
  })
})

test('should handle undefined cause explicitly set', (t) => {
  t.plan(2)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const error = Error('test error')
    error.cause = undefined

    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.deepEqual(parsed, [])
  })
})

test('should handle false as cause', (t) => {
  t.plan(2)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const error = Error('test error')
    error.cause = false

    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.deepEqual(parsed, [])
  })
})

test('should handle 0 as cause', (t) => {
  t.plan(2)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const error = Error('test error')
    error.cause = 0

    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.deepEqual(parsed, [])
  })
})

test('should handle empty string as cause', (t) => {
  t.plan(2)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const error = Error('test error')
    error.cause = ''

    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.deepEqual(parsed, [])
  })
})

test('should handle empty object as cause', (t) => {
  t.plan(2)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const error = Error('test error')
    error.cause = {}

    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])
    t.assert.deepEqual(parsed, [{ message: 'cause does not look like an Error instance' }])
  })
})

test('should handle three-level deep error chain', (t) => {
  t.plan(8)
  const { agent } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const level3 = Error('level 3')
    const level2 = Error('level 2')
    level2.cause = level3
    const level1 = Error('level 1')
    level1.cause = level2
    const error = Error('top level')
    error.cause = level1

    const exception = new Exception({ error })
    const errorTrace = createError(tx, exception, agent.config)
    const params = errorTrace[4]

    t.assert.equal(typeof params.agentAttributes['error.cause'], 'string')
    const parsed = JSON.parse(params.agentAttributes['error.cause'])

    // Check level 1
    t.assert.equal(parsed[0].message, 'level 1')
    t.assert.ok(parsed[0].stack)

    // Check level 2
    t.assert.equal(parsed[0].cause[0].message, 'level 2')
    t.assert.ok(parsed[0].cause[0].stack)

    // Check level 3
    t.assert.equal(parsed[0].cause[0].cause[0].message, 'level 3')
    t.assert.ok(parsed[0].cause[0].cause[0].stack)
    t.assert.deepEqual(parsed[0].cause[0].cause[0].cause, [])
  })
})
