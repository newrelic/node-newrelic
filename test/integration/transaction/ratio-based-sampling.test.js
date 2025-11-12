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

// The real function we are testing is `decideSamplingFromW3cData`
// in lib/transaction/index.js

// root: 0, remote_parent_sampled: 1, remote_parent_not_sampled: 0
//      when the trace originates from the current service, never sample
//      when the upstream service has sampled the trace, always sample
//      when the upstream service has not sampled the trace, never sample
test('root=0, remote_parent_sampled=1, remote_parent_not_sampled=0', async (t) => {
  t.beforeEach(function (ctx) {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent({
      distributed_tracing: {
        enabled: true,
        sampler: {
          root: {
            trace_id_ratio_based: {
              ratio: 0
            }
          },
          remote_parent_sampled: {
            trace_id_ratio_based: {
              ratio: 1
            }
          },
          remote_parent_not_sampled: {
            trace_id_ratio_based: {
              ratio: 0
            }
          }
        }
      },
      span_events: { enabled: true }
    })
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('does not sample trace from current service when root.trace_id_ratio_based.ratio=0', (t, end) => {
    const { agent } = t.nr
    agent.config.trusted_account_key = '33'

    helper.runInTransaction(agent, function (txn) {
      const childSegment = txn.trace.add('child')
      agent.tracer.setSegment({ segment: childSegment })
      childSegment.start()

      txn.end()
      assert.equal(txn.sampled, false, 'should never sample when ratio=0')
      end()
    })
  })

  await t.test('samples sampled upstream trace when remote_parent_sampled.trace_id_ratio_based.ratio=1', (t, end) => {
    const { agent } = t.nr
    agent.config.trusted_account_key = '33'

    const incomingSampledTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
    const incomingSampledTracestate =
          '33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-1518469636035,test=test'

    helper.runInTransaction(agent, function (txn) {
      const childSegment = txn.trace.add('child')
      agent.tracer.setSegment({ segment: childSegment })
      childSegment.start()

      txn.acceptTraceContextPayload(incomingSampledTraceparent, incomingSampledTracestate)

      assert.equal(txn.traceId, '4bf92f3577b34da6a3ce929d0e0e4736')
      assert.equal(txn.parentSpanId, '00f067aa0ba902b7')
      assert.equal(txn.sampled, true, 'should always sample when ratio=1')

      txn.end()
      end()
    })
  })

  await t.test('does not sample unsampled upstream trace when remote_parent_not_sampled.trace_id_ratio_based.ratio=0', (t, end) => {
    const { agent } = t.nr
    agent.config.trusted_account_key = '33'

    const incomingNotSampledTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
    const incomingNotSampledTracestate =
          '33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-0-1.23456-1518469636035,test=test'

    helper.runInTransaction(agent, function (txn) {
      const childSegment = txn.trace.add('child')
      agent.tracer.setSegment({ segment: childSegment })
      childSegment.start()

      txn.acceptTraceContextPayload(incomingNotSampledTraceparent, incomingNotSampledTracestate)

      assert.equal(txn.traceId, '4bf92f3577b34da6a3ce929d0e0e4736')
      assert.equal(txn.parentSpanId, '00f067aa0ba902b7')
      assert.equal(txn.sampled, false, 'should never sample when ratio=0')
      txn.end()
      end()
    })
  })
})
