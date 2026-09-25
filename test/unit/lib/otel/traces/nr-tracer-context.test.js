/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Integration-level tests for NrTracer context propagation.
 *
 * These tests require the full NR agent so that the NR ContextManager is
 * installed as the OTel global context manager (see lib/otel/setup.js).
 * Without it, context.with / context.active use the NoopContextManager and
 * context does not propagate across async boundaries.
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const otel = require('@opentelemetry/api')
const helper = require('#testlib/agent_helper.js')
const NrSpan = require('#agentlib/otel/traces/nr-span.js').NrSpan

function setup() {
  return helper.instrumentMockedAgent({
    opentelemetry: { enabled: true, traces: { enabled: true } }
  })
}

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('startActiveSpan makes the span retrievable via context.active() inside the callback', (t, end) => {
  t.nr = { agent: setup() }
  const tracer = otel.trace.getTracer('test', '1.0')

  helper.runInTransaction(t.nr.agent, () => {
    tracer.startActiveSpan('op', (span) => {
      const active = otel.trace.getSpan(otel.context.active())
      assert.strictEqual(active, span)
      span.end()
      end()
    })
  })
})

test('nested startActiveSpan calls produce correct parentSpanId on the child', (t, end) => {
  t.nr = { agent: setup() }
  const tracer = otel.trace.getTracer('test', '1.0')

  helper.runInTransaction(t.nr.agent, () => {
    tracer.startActiveSpan('parent', (parent) => {
      assert.ok(parent instanceof NrSpan)

      tracer.startActiveSpan('child', (child) => {
        assert.ok(child instanceof NrSpan)
        assert.equal(child.parentSpanId, parent.spanContext().spanId)
        assert.equal(child.spanContext().traceId, parent.spanContext().traceId)
        child.end()
        parent.end()
        end()
      })
    })
  })
})

test('spans created by different tracer instances share traceId when nested', (t, end) => {
  t.nr = { agent: setup() }
  const tracer1 = otel.trace.getTracer('lib-a', '1.0')
  const tracer2 = otel.trace.getTracer('lib-b', '2.0')

  helper.runInTransaction(t.nr.agent, () => {
    tracer1.startActiveSpan('outer', (outer) => {
      tracer2.startActiveSpan('inner', (inner) => {
        assert.equal(inner.spanContext().traceId, outer.spanContext().traceId)
        assert.equal(inner.parentSpanId, outer.spanContext().spanId)
        inner.end()
        outer.end()
        end()
      })
    })
  })
})
