/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const helper = require('#testlib/agent_helper.js')

// TODO: unsure if this is the best place for this
// Basically I want to make sure all the nuances that are
// out of scope for test/unit/ratio-based-sampler.test.js
// are tested in an actual transaction.

test('acceptTraceContextPayload with TraceIdRatioBasedSampler', async (t) => {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      distributed_tracing: {
        sampler: {
          root: {
            trace_id_ratio_based: {
              ratio: 1
            }
          },
          remote_parent_sampled: {
            trace_id_ratio_based: {
              ratio: 1
            }
          },
          remote_parent_not_sampled: {
            trace_id_ratio_based: {
              ratio: 1
            }
          }
        }
      }
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('should accept a valid trace context traceparent header', (t, end) => {
    const { agent } = t.nr
    agent.config.distributed_tracing.enabled = true
    agent.config.trusted_account_key = '1'
    agent.config.span_events.enabled = true

    const goodParent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

    helper.runInTransaction(agent, function (txn) {
      const childSegment = txn.trace.add('child')
      childSegment.start()

      txn.acceptTraceContextPayload(goodParent, 'stuff')

      assert.equal(txn.traceId, '4bf92f3577b34da6a3ce929d0e0e4736')
      assert.equal(txn.parentSpanId, '00f067aa0ba902b7')
      assert.equal(txn.sampled, true, 'should always sample when ratio=1')

      txn.end()
      end()
    })
  })
})
