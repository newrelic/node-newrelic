/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const TraceStacks = require('../../../lib/util/trace-stacks')

test('should create a stack if logging.diagnostics is true', () => {
  const config = {
    logging: {
      diagnostics: true
    }
  }
  const traceStacks = new TraceStacks(config)
  assert.deepEqual(traceStacks.stack, [])
})

test('should not create a stack if logging.diagnostics is false', () => {
  const config = {
    logging: {
      diagnostics: false
    }
  }
  const traceStacks = new TraceStacks(config)
  assert.deepEqual(traceStacks.stack, null)
})

test('should properly serialize the stack', () => {
  const config = {
    logging: {
      diagnostics: true
    }
  }
  const traceStacks = new TraceStacks(config)
  traceStacks.probe('test', { key: 'value' })
  traceStacks.probe('test2', { key: 'value2' })
  const serialized = traceStacks.serialize('my segment')
  assert.equal(serialized.segment, 'my segment')
  assert.ok(serialized.stacks.length, 2)
  serialized.stacks.forEach((stack) => {
    assert.ok(stack.stack)
    assert.ok(stack.extra)
  })
})
