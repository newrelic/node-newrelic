/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('#testlib/agent_helper.js')
const Span = require('#agentlib/spans/span.js')
const { PARTIAL_TYPES } = require('#agentlib/transaction/index.js')
const MODES = [PARTIAL_TYPES.REDUCED, PARTIAL_TYPES.ESSENTIAL, PARTIAL_TYPES.COMPACT]

for (const mode of MODES) {
  test(`Partial Granularity Spans - ${mode} mode`, async (t) => {
    t.beforeEach((ctx) => {
      const agent = helper.loadMockedAgent({
        distributed_tracing: {
          enabled: true,
          sampler: {
            full_granularity: {
              enabled: false
            },
            partial_granularity: {
              enabled: true,
              type: mode
            }
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
        transaction.createPartialTrace()
        const segment = transaction.trace.add('entrySpan')
        let span = Span.fromSegment({ segment, transaction, isEntry: true })
        span = span.applyPartialTraceRules({ isEntry: true, partialTrace: transaction.partialTrace })
        assert.ok(span)
        const [intrinsics] = span.toJSON()
        assert.equal(intrinsics['nr.entryPoint'], true)
        assert.equal(intrinsics['nr.pg'], true)
        assert.equal(intrinsics.parentId, null)
        end()
      })
    })

    await t.test('should include Llm span', (t, end) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (transaction) => {
        transaction.partialType = mode
        transaction.createPartialTrace()
        const segment = transaction.trace.add('Llm/foobar')
        let span = Span.fromSegment({ segment, transaction })
        span = span.applyPartialTraceRules({ partialTrace: transaction.partialTrace })
        assert.ok(span)
        end()
      })
    })

    // This is the only test where assertions will vary depending on the mode:
    //  - reduced: should include all attributes
    //  - essential and compact: should exclude any agent attributes that are not entity relationship attrs and drop all custom attributes
    await t.test('should include exit span that has entity relationship attrs', (t, end) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (transaction) => {
        transaction.partialType = mode
        transaction.createPartialTrace()
        const segment = transaction.trace.add('Datastore/operation/Redis/SET')
        segment.addAttribute('host', 'redis-service')
        segment.addAttribute('port_path_or_id', 6379)
        segment.addAttribute('foo', 'bar')

        const spanContext = segment.getSpanContext()
        spanContext.addCustomAttribute('custom', 'test')
        spanContext.hasError = true
        spanContext.errorDetails = { message: 'You failed', type: 'TestError', expected: true }
        let span = Span.fromSegment({ segment, transaction })
        span = span.applyPartialTraceRules({ partialTrace: transaction.partialTrace })
        assert.ok(span)
        const [intrinsics, customAttrs, agentAttrs] = span.toJSON()
        assert.equal(intrinsics['name'], 'Datastore/operation/Redis/SET')
        assert.equal(intrinsics['span.kind'], 'client')
        assert.equal(intrinsics['nr.entryPoint'], null)
        assert.equal(intrinsics['nr.pg'], null)
        if (mode === PARTIAL_TYPES.REDUCED) {
          assert.equal(agentAttrs['peer.address'], 'redis-service:6379')
          assert.deepEqual(customAttrs, {
            custom: 'test'
          })
          assert.equal(agentAttrs.foo, 'bar')
        } else if (mode === PARTIAL_TYPES.ESSENTIAL || mode === PARTIAL_TYPES.COMPACT) {
          assert.equal(agentAttrs['peer.address'], undefined)
          assert.deepEqual(customAttrs, {})
          assert.equal(agentAttrs.foo, undefined)
        }
        assert.equal(agentAttrs['peer.hostname'], 'redis-service')
        assert.equal(agentAttrs['server.address'], 'redis-service')
        assert.equal(agentAttrs['server.port'], '6379')
        assert.equal(agentAttrs['error.message'], 'You failed')
        assert.equal(agentAttrs['error.class'], 'TestError')
        assert.equal(agentAttrs['error.expected'], true)
        end()
      })
    })

    await t.test('should not include exit span that does not have entity relationship attrs', (t, end) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (transaction) => {
        transaction.partialType = mode
        transaction.createPartialTrace()
        const segment = transaction.trace.add('Datastore/operation/Redis/SET')
        segment.addAttribute('foo', 'bar')
        let span = Span.fromSegment({ segment, transaction })
        span = span.applyPartialTraceRules({ partialTrace: transaction.partialTrace })
        assert.ok(!span)
        end()
      })
    })

    await t.test('should not include in process span', (t, end) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (transaction) => {
        transaction.partialType = mode
        transaction.createPartialTrace()
        const segment = transaction.trace.add('test-segment')
        segment.addAttribute('foo', 'bar')
        let span = Span.fromSegment({ segment, transaction })
        span = span.applyPartialTraceRules({ partialTrace: transaction.partialTrace })
        assert.ok(!span)
        end()
      })
    })

    await t.test('should assign exit spans to appropriate `partialTrace.compactSpanGroups`', { skip: mode !== PARTIAL_TYPES.COMPACT }, (t) => {
      const { agent } = t.nr
      helper.runInTransaction(agent, (transaction) => {
        transaction.partialType = mode
        transaction.createPartialTrace()
        const segment = transaction.trace.add('Datastore/operation/Redis/SET')
        segment.addAttribute('host', 'redis-service')
        segment.addAttribute('port_path_or_id', 6379)
        const segment2 = transaction.trace.add('Datastore/operation/Redis/GET')
        segment2.addAttribute('host', 'redis-service')
        segment2.addAttribute('port_path_or_id', 6379)
        const segment3 = transaction.trace.add('Datastore/operation/Redis/SET')
        segment3.addAttribute('host', 'diff-redis-service')
        segment3.addAttribute('port_path_or_id', 6379)
        assert.deepEqual(transaction.partialTrace.compactSpanGroups, {})
        // kept as first exit span
        let span = Span.fromSegment({ segment, transaction })
        span = span.applyPartialTraceRules({ partialTrace: transaction.partialTrace })
        // dropped as same entity relationship attrs as first span
        let span2 = Span.fromSegment({ segment: segment2, transaction })
        span2 = span2.applyPartialTraceRules({ partialTrace: transaction.partialTrace })
        // kept as first exit span with diff entity relationship attrs
        let span3 = Span.fromSegment({ segment: segment3, transaction })
        span3 = span3.applyPartialTraceRules({ partialTrace: transaction.partialTrace })
        assert.ok(span)
        assert.ok(!span2)
        assert.ok(span3)
        assert.deepEqual(transaction.partialTrace.compactSpanGroups[segment.id].length, 2)
        assert.equal(transaction.partialTrace.compactSpanGroups[segment.id][0].id, segment.id)
        assert.equal(transaction.partialTrace.compactSpanGroups[segment.id][1].id, segment2.id)
        assert.deepEqual(transaction.partialTrace.compactSpanGroups[segment3.id].length, 1)
        assert.equal(transaction.partialTrace.compactSpanGroups[segment3.id][0].id, segment3.id)
      })
    })
  })
}
