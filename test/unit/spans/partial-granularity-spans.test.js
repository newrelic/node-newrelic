/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('#testlib/agent_helper.js')
const SpanEvent = require('#agentlib/spans/span-event.js')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent({
    distributed_tracing: {
      enabled: true,
      full_granularity: {
        enabled: false
      },
      partial_granularity: {
        enabled: true,
        type: 'reduced'
      }
    }
  })
  ctx.nr = { agent }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should include entry span', (t, end) => {
  const { agent } = t.nr
  helper.runInTransaction(agent, (transaction) => {
    transaction.isPartialTrace = true
    const segment = transaction.trace.add('entrySpan')
    transaction.baseSegment = segment
    const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true, partialGranularityMode: 'reduced' })
    assert.ok(span)
    assert.equal(span.intrinsics['nr.entryPoint'], true)
    assert.equal(span.intrinsics['nr.pg'], true)
    assert.equal(span.intrinsics.parentId, null)
    end()
  })
})

test('should include Llm span', (t, end) => {
  const { agent } = t.nr
  helper.runInTransaction(agent, (transaction) => {
    transaction.isPartialTrace = true
    const segment = transaction.trace.add('Llm/foobar')
    const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true, partialGranularityMode: 'reduced' })
    assert.ok(span)
    end()
  })
})

test('should include exit span that has entity relationship attrs', (t, end) => {
  const { agent } = t.nr
  helper.runInTransaction(agent, (transaction) => {
    transaction.isPartialTrace = true
    const segment = transaction.trace.add('Datastore/operation/Redis/SET')
    segment.addAttribute('host', 'redis-service')
    segment.addAttribute('port_path_or_id', 6379)
    segment.addAttribute('foo', 'bar')
    const spanContext = segment.getSpanContext()
    spanContext.addCustomAttribute('custom', 'test')
    const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true, partialGranularityMode: 'reduced' })
    assert.ok(span)
    const [instrinsics, customAttrs, agentAttrs] = span.toJSON()
    assert.equal(instrinsics['name'], 'Datastore/operation/Redis/SET')
    assert.equal(instrinsics['span.kind'], 'client')
    assert.deepEqual(customAttrs, {
      custom: 'test'
    })
    assert.equal(span.intrinsics['nr.entryPoint'], null)
    assert.equal(span.intrinsics['nr.pg'], null)
    assert.equal(agentAttrs['peer.address'], 'redis-service:6379')
    assert.equal(agentAttrs['peer.hostname'], 'redis-service')
    assert.equal(agentAttrs['server.address'], 'redis-service')
    assert.equal(agentAttrs['server.port'], '6379')
    assert.equal(agentAttrs.foo, 'bar')
    end()
  })
})

test('should not include exit span that does not have entity relationship attrs', (t, end) => {
  const { agent } = t.nr
  helper.runInTransaction(agent, (transaction) => {
    transaction.isPartialTrace = true
    const segment = transaction.trace.add('Datastore/operation/Redis/SET')
    segment.addAttribute('foo', 'bar')
    const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true, partialGranularityMode: 'reduced' })
    assert.ok(!span)
    end()
  })
})

test('should not include in process span', (t, end) => {
  const { agent } = t.nr
  helper.runInTransaction(agent, (transaction) => {
    transaction.isPartialTrace = true
    const segment = transaction.trace.add('test-segment')
    segment.addAttribute('foo', 'bar')
    const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true, partialGranularityMode: 'reduced' })
    assert.ok(!span)
    end()
  })
})

test('should include exit span that does not have entity relationship attrs when not part of partialTrace', (t, end) => {
  const { agent } = t.nr
  helper.runInTransaction(agent, (transaction) => {
    transaction.isPartialTrace = false
    const segment = transaction.trace.add('Datastore/operation/Redis/SET')
    segment.addAttribute('foo', 'bar')
    const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true, partialGranularityMode: 'reduced' })
    assert.ok(span)
    const [instrinsics, , agentAttrs] = span.toJSON()
    assert.equal(instrinsics['name'], 'Datastore/operation/Redis/SET')
    assert.equal(instrinsics['span.kind'], 'client')
    assert.equal(span.intrinsics['nr.entryPoint'], null)
    assert.equal(span.intrinsics['nr.pg'], null)
    assert.equal(agentAttrs.foo, 'bar')
    end()
  })
})

test('should include in process span when not part of partialTrace', (t, end) => {
  const { agent } = t.nr
  helper.runInTransaction(agent, (transaction) => {
    transaction.isPartialTrace = false
    const segment = transaction.trace.add('test-segment')
    const spanContext = segment.getSpanContext()
    spanContext.addCustomAttribute('custom', 'test')
    segment.addAttribute('foo', 'bar')
    const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true, partialGranularityMode: 'reduced' })
    assert.ok(span)
    const [instrinsics, customAttrs, agentAttrs] = span.toJSON()
    assert.equal(instrinsics['name'], 'test-segment')
    assert.equal(instrinsics['span.kind'], 'internal')
    assert.deepEqual(customAttrs, {
      custom: 'test'
    })
    assert.equal(span.intrinsics['nr.entryPoint'], null)
    assert.equal(span.intrinsics['nr.pg'], null)
    assert.equal(agentAttrs.foo, 'bar')
    end()
  })
})
