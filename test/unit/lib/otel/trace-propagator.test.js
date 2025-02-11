/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('#testlib/agent_helper.js')
const otel = require('@opentelemetry/api')
const NewRelicTracePropagator = require('#agentlib/otel/trace-propagator.js')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent({
    feature_flag: {
      opentelemetry_bridge: true
    }
  })
  ctx.nr = { agent }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should set traceparent on context when otel root context is passed in', (t) => {
  const { agent } = t.nr
  const propagation = new NewRelicTracePropagator(agent)
  helper.runInTransaction(agent, (tx) => {
    otel.trace.getSpanContext = function wrappedSpanContext() {
      return {
        traceId: tx.traceId,
        spanId: tx.trace.root.id,
        traceFlags: otel.TraceFlags.SAMPLED
      }
    }

    const carrier = {}
    const setter = {
      set: (c, key, payload) => {
        assert.deepEqual(c, carrier)
        assert.equal(key, 'traceparent')
        assert.equal(payload, `00-${tx.traceId}-${tx.trace.root.id}-0${otel.TraceFlags.SAMPLED}`)
      }
    }
    propagation.inject(otel.ROOT_CONTEXT, carrier, setter)
  })
})

test('should return agent context when root context is passed in', (t) => {
  const { agent } = t.nr
  const propagation = new NewRelicTracePropagator(agent)
  const carrier = {}
  const getter = {
    get: () => null
  }
  const ctx = propagation.extract(otel.ROOT_CONTEXT, carrier, getter)
  assert.equal(ctx.transaction, undefined)
  assert.equal(ctx.segment, undefined)
  assert.ok(ctx._otelCtx)
})
