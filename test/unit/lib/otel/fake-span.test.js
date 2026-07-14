/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')
const FakeSpan = require('#agentlib/otel/fake-span.js')
const TraceSegment = require('#agentlib/transaction/trace/segment.js')

test.beforeEach((ctx) => {
  ctx.nr = {}
  ctx.nr.agent = helper.loadMockedAgent()
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should create a fake span from segment and transaction', () => {
  const segment = { id: 'id' }
  const tx = { traceId: 'traceId' }
  const span = new FakeSpan(segment, tx)
  assert.equal(span.segmentId, 'id')
  assert.equal(span.traceId, 'traceId')
  const spanCtx = span.spanContext()
  assert.deepEqual(spanCtx, {
    spanId: 'id',
    traceId: 'traceId',
    traceFlags: 1
  })
})

test('should add attributes to the segment', () => {
  const segment = new TraceSegment({
    id: 'id',
    config: { attributes: {} },
    name: 'test-segment',
    parentId: 1,
    collect: true
  })
  const tx = { traceId: 'traceId' }
  const span = new FakeSpan(segment, tx)

  let instance = span.setAttribute('foo', 'bar')
  assert.deepEqual(segment.attributes.attributes.foo, {
    value: 'bar',
    destinations: 48,
    truncateExempt: false
  })
  assert.equal(instance, span)

  instance = span.setAttributes({ one: 1, two: 2 })
  assert.deepEqual(segment.attributes.attributes.one, {
    value: 1,
    destinations: 48,
    truncateExempt: false
  })
  assert.deepEqual(segment.attributes.attributes.two, {
    value: 2,
    destinations: 48,
    truncateExempt: false
  })
  assert.equal(instance, span)
})

test('addEvent should log warning', () => {
  const logs = []
  const logger = {
    warn(msg, name) {
      logs.push([msg, name])
    }
  }
  const segment = new TraceSegment({
    id: 'id',
    config: { attributes: {} },
    name: 'test-segment',
    parentId: 1,
    collect: true
  })
  segment.logger = logger
  const tx = { traceId: 'traceId' }
  const span = new FakeSpan(segment, tx)

  const instance = span.addEvent('foo')
  assert.equal(instance, span)
  assert.deepEqual(logs, [[
    'addEvent is not implemented. Not adding event: %s.',
    'foo'
  ]])
})

test('should add links to spans', () => {
  const segment = new TraceSegment({
    id: 'id',
    config: { attributes: {} },
    name: 'test-segment',
    parentId: 1,
    collect: true
  })
  const tx = { traceId: 'traceId' }
  const span = new FakeSpan(segment, tx)

  let instance = span.addLink({
    attributes: { foo: 'foo' }
  })
  assert.deepEqual(segment.spanLinks, [{
    attributes: { foo: 'foo' }
  }])
  assert.equal(instance, span)

  instance = span.addLinks([
    { attributes: { bar: 'bar' } },
    { attributes: { baz: 'baz' } }
  ])
  assert.deepEqual(segment.spanLinks, [

    { attributes: { foo: 'foo' } },
    { attributes: { bar: 'bar' } },
    { attributes: { baz: 'baz' } }
  ])
  assert.equal(instance, span)
})

test('setStatus should log warning', () => {
  const logs = []
  const logger = {
    warn(msg, name) {
      logs.push([msg, name])
    }
  }
  const segment = new TraceSegment({
    id: 'id',
    config: { attributes: {} },
    name: 'test-segment',
    parentId: 1,
    collect: true
  })
  segment.logger = logger
  const tx = { traceId: 'traceId' }
  const span = new FakeSpan(segment, tx)

  const instance = span.setStatus({ code: -1 })
  assert.equal(instance, span)
  assert.deepEqual(logs, [[
    'setStatus is not implemented. Not setting status: %s.',
    -1
  ]])
})

test('updateName should log warning', () => {
  const logs = []
  const logger = {
    warn(msg, name) {
      logs.push([msg, name])
    }
  }
  const segment = new TraceSegment({
    id: 'id',
    config: { attributes: {} },
    name: 'test-segment',
    parentId: 1,
    collect: true
  })
  segment.logger = logger
  const tx = { traceId: 'traceId' }
  const span = new FakeSpan(segment, tx)

  const instance = span.updateName('test')
  assert.equal(instance, span)
  assert.deepEqual(logs, [[
    'updateName is not implemented. Not setting name: %s.',
    'test'
  ]])
})

test('end should log warning', () => {
  const logs = []
  const logger = {
    warn(msg, name) {
      logs.push([msg, name])
    }
  }
  const segment = new TraceSegment({
    id: 'id',
    config: { attributes: {} },
    name: 'test-segment',
    parentId: 1,
    collect: true
  })
  segment.logger = logger
  const tx = { traceId: 'traceId' }
  const span = new FakeSpan(segment, tx)

  const instance = span.end()
  assert.equal(instance, undefined)
  assert.deepEqual(logs, [[
    'end is not implemented. Not ending span.',
    undefined
  ]])
})

test('recording returns true', () => {
  const segment = new TraceSegment({
    id: 'id',
    config: { attributes: {} },
    name: 'test-segment',
    parentId: 1,
    collect: true
  })
  const tx = { traceId: 'traceId' }
  const span = new FakeSpan(segment, tx)
  assert.deepEqual(span.isRecording(), true)
})

test('recordException should log warning', () => {
  const logs = []
  const logger = {
    warn(msg, name) {
      logs.push([msg, name])
    }
  }
  const segment = new TraceSegment({
    id: 'id',
    config: { attributes: {} },
    name: 'test-segment',
    parentId: 1,
    collect: true
  })
  segment.logger = logger
  const tx = { traceId: 'traceId' }
  const span = new FakeSpan(segment, tx)

  const instance = span.recordException('foo', 'whatever')
  assert.equal(instance, undefined)
  assert.deepEqual(logs, [[
    'addEvent is not implemented. Not adding event: %s.',
    'foo'
  ]])
})
