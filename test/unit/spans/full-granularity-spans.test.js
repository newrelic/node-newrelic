/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('#testlib/agent_helper.js')
const SpanEvent = require('#agentlib/spans/span-event.js')

test('Partial Granularity metrics with Full Granularity settings', async (t) => {
  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent({
      distributed_tracing: {
        enabled: true,
        sampler: {
          full_granularity: {
            enabled: true
          },
          partial_granularity: {
            enabled: false,
          }
        }
      }
    })
    ctx.nr = { agent }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should not record partial granularity metrics when not part of partialTrace', (t, end) => {
    const { agent } = t.nr
    helper.runInTransaction(agent, (transaction) => {
      const segment = transaction.trace.add('Datastore/operation/Redis/SET')
      const span = SpanEvent.fromSegment({ segment, transaction, inProcessSpans: true })
      assert.ok(span)
      transaction.end()
      const unscopedMetrics = agent.metrics._metrics.unscoped
      assert.equal(unscopedMetrics['Supportability/DistributedTrace/PartialGranularity/reduced/Span/Instrumented'], undefined)
      assert.equal(unscopedMetrics['Supportability/DistributedTrace/PartialGranularity/reduced/Span/Kept'], undefined)
      assert.equal(unscopedMetrics['Supportability/DistributedTrace/PartialGranularity/essential/Span/Instrumented'], undefined)
      assert.equal(unscopedMetrics['Supportability/DistributedTrace/PartialGranularity/essential/Span/Kept'], undefined)
      end()
    })
  })
})
