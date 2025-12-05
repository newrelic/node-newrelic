/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('#testlib/agent_helper.js')
const SpanEvent = require('#agentlib/spans/span-event.js')
const MODES = ['reduced', 'essential']

for (const mode of MODES) {
  test(`Partial Granularity Spans - ${mode} mode`, async (t) => {
    t.beforeEach((ctx) => {
      const agent = helper.loadMockedAgent({
        distributed_tracing: {
          enabled: true,
          full_granularity: {
            enabled: false
          },
          partial_granularity: {
            enabled: true,
            type: mode
          }
        }
      })
      ctx.nr = { agent }
    })

    t.afterEach((ctx) => {
      helper.unloadAgent(ctx.nr.agent)
    })

    await t.test('should include entry span', (t, end) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (transaction) => {
        transaction.partialType = mode
        const segment = transaction.trace.add('entrySpan')
        transaction.baseSegment = segment
        const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true })
        assert.ok(span)
        const [intrinsics] = span.toJSON()
        assert.equal(intrinsics['nr.entryPoint'], true)
        assert.equal(intrinsics['nr.pg'], true)
        assert.equal(intrinsics.parentId, null)
        transaction.end()
        end()
      })
    })

    await t.test('should include Llm span', (t, end) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (transaction) => {
        transaction.partialType = mode
        const segment = transaction.trace.add('Llm/foobar')
        const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true })
        assert.ok(span)
        transaction.end()
        end()
      })
    })

    // This is the only test where assertions will vary depending on the mode:
    //  - reduced: should include all attributes
    //  - essential: should exclude any agent attributes that are no entity relationship attrs and drop all custom attributes
    await t.test('should include exit span that has entity relationship attrs', (t, end) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (transaction) => {
        transaction.partialType = mode
        const segment = transaction.trace.add('Datastore/operation/Redis/SET')
        segment.addAttribute('host', 'redis-service')
        segment.addAttribute('port_path_or_id', 6379)
        segment.addAttribute('foo', 'bar')
        const spanContext = segment.getSpanContext()
        spanContext.addCustomAttribute('custom', 'test')
        const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true })
        assert.ok(span)
        const [intrinsics, customAttrs, agentAttrs] = span.toJSON()
        assert.equal(intrinsics['name'], 'Datastore/operation/Redis/SET')
        assert.equal(intrinsics['span.kind'], 'client')
        assert.equal(intrinsics['nr.entryPoint'], null)
        assert.equal(intrinsics['nr.pg'], null)
        if (mode === 'reduced') {
          assert.equal(agentAttrs['peer.address'], 'redis-service:6379')
          assert.deepEqual(customAttrs, {
            custom: 'test'
          })
          assert.equal(agentAttrs.foo, 'bar')
        } else if (mode === 'essential') {
          assert.equal(agentAttrs['peer.address'], undefined)
          assert.deepEqual(customAttrs, {})
          assert.equal(agentAttrs.foo, undefined)
        }
        assert.equal(agentAttrs['peer.hostname'], 'redis-service')
        assert.equal(agentAttrs['server.address'], 'redis-service')
        assert.equal(agentAttrs['server.port'], '6379')
        transaction.end()
        end()
      })
    })

    await t.test('should not include exit span that does not have entity relationship attrs', (t, end) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (transaction) => {
        transaction.partialType = mode
        const segment = transaction.trace.add('Datastore/operation/Redis/SET')
        segment.addAttribute('foo', 'bar')
        const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true })
        assert.ok(!span)
        end()
      })
    })

    await t.test('should not include in process span', (t, end) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (transaction) => {
        transaction.partialType = mode
        const segment = transaction.trace.add('test-segment')
        segment.addAttribute('foo', 'bar')
        const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true })
        assert.ok(!span)
        transaction.end()
        end()
      })
    })

    await t.test('should include exit span that does not have entity relationship attrs when not part of partialTrace', (t, end) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (transaction) => {
        transaction.partialType = undefined
        const segment = transaction.trace.add('Datastore/operation/Redis/SET')
        segment.addAttribute('foo', 'bar')
        const spanContext = segment.getSpanContext()
        spanContext.addCustomAttribute('custom', 'test')
        const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true })
        assert.ok(span)
        const [intrinsics, customAttrs, agentAttrs] = span.toJSON()
        assert.equal(intrinsics['name'], 'Datastore/operation/Redis/SET')
        assert.equal(intrinsics['span.kind'], 'client')
        assert.deepEqual(customAttrs, {
          custom: 'test'
        })
        assert.equal(intrinsics['nr.entryPoint'], null)
        assert.equal(intrinsics['nr.pg'], null)
        assert.equal(agentAttrs.foo, 'bar')
        transaction.end()
        end()
      })
    })

    await t.test('should include in process span when not part of partialTrace', (t, end) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (transaction) => {
        transaction.partialType = undefined
        const segment = transaction.trace.add('test-segment')
        const spanContext = segment.getSpanContext()
        spanContext.addCustomAttribute('custom', 'test')
        segment.addAttribute('foo', 'bar')
        const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true })
        assert.ok(span)
        const [intrinsics, customAttrs, agentAttrs] = span.toJSON()
        assert.equal(intrinsics['name'], 'test-segment')
        assert.equal(intrinsics['span.kind'], 'internal')
        assert.deepEqual(customAttrs, {
          custom: 'test'
        })
        assert.equal(intrinsics['nr.entryPoint'], null)
        assert.equal(intrinsics['nr.pg'], null)
        assert.equal(agentAttrs.foo, 'bar')
        transaction.end()
        end()
      })
    })
  })
}
