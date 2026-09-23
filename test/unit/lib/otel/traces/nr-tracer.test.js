/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { describe, test } = require('node:test')
const assert = require('node:assert')
const { ROOT_CONTEXT, SpanKind, context, trace } = require('@opentelemetry/api')
const { SamplingDecision, SUPPRESS_TRACING_KEY } = require('#agentlib/otel/constants.js')
const NrTracer = require('#agentlib/otel/traces/nr-tracer.js')
const NrSpan = require('#agentlib/otel/traces/nr-span.js').NrSpan
const { makeProcessor, makeSampler } = require('./helpers')

function makeTracer(decision) {
  const processor = makeProcessor()
  const tracer = new NrTracer({
    instrumentationScope: { name: 'test', version: '1.0' },
    sampler: makeSampler(decision),
    processor
  })
  return { processor, tracer }
}

describe('startSpan', () => {
  test('returns an NrSpan when sampled', () => {
    const { tracer } = makeTracer()
    const span = tracer.startSpan('op', {}, ROOT_CONTEXT)
    assert.ok(span instanceof NrSpan)
  })

  test('returns a non-recording span when NOT_RECORD', () => {
    const { tracer } = makeTracer(SamplingDecision.NOT_RECORD)
    const span = tracer.startSpan('op', {}, ROOT_CONTEXT)
    assert.ok(!(span instanceof NrSpan))
    assert.equal(span.isRecording(), false)
  })

  test('calls processor.onStart', () => {
    const { processor, tracer } = makeTracer()
    tracer.startSpan('op', {}, ROOT_CONTEXT)
    assert.equal(processor.calls.onStart.length, 1)
    assert.ok(processor.calls.onStart[0] instanceof NrSpan)
  })

  test('generates a traceId when there is no parent context', () => {
    const { tracer } = makeTracer()
    const span = tracer.startSpan('op', {}, ROOT_CONTEXT)
    const { traceId } = span.spanContext()
    assert.match(traceId, /^[0-9a-f]{32}$/)
  })

  test('inherits traceId from parent span context', () => {
    const { tracer } = makeTracer()
    const parent = tracer.startSpan('parent', {}, ROOT_CONTEXT)
    const parentCtx = trace.setSpan(ROOT_CONTEXT, parent)
    const child = tracer.startSpan('child', {}, parentCtx)
    assert.equal(child.spanContext().traceId, parent.spanContext().traceId)
  })

  test('sets parentSpanId from parent span context', () => {
    const { tracer } = makeTracer()
    const parent = tracer.startSpan('parent', {}, ROOT_CONTEXT)
    const parentCtx = trace.setSpan(ROOT_CONTEXT, parent)
    const child = tracer.startSpan('child', {}, parentCtx)
    assert.equal(child.parentSpanId, parent.spanContext().spanId)
  })

  test('sets span kind from options', () => {
    const { tracer } = makeTracer()
    const span = tracer.startSpan('op', { kind: SpanKind.SERVER }, ROOT_CONTEXT)
    assert.equal(span.kind, SpanKind.SERVER)
  })

  test('defaults to INTERNAL span kind', () => {
    const { tracer } = makeTracer()
    const span = tracer.startSpan('op', {}, ROOT_CONTEXT)
    assert.equal(span.kind, SpanKind.INTERNAL)
  })

  test('attaches instrumentation scope', () => {
    const { tracer } = makeTracer()
    const span = tracer.startSpan('op', {}, ROOT_CONTEXT)
    assert.equal(span.instrumentationScope.name, 'test')
    assert.equal(span.instrumentationScope.version, '1.0')
  })

  test('ignores parent context when options.root is true', () => {
    const { tracer } = makeTracer()
    const parent = tracer.startSpan('parent', {}, ROOT_CONTEXT)
    const parentCtx = trace.setSpan(ROOT_CONTEXT, parent)
    const child = tracer.startSpan('child', { root: true }, parentCtx)
    assert.notEqual(child.spanContext().traceId, parent.spanContext().traceId)
    assert.equal(child.parentSpanId, undefined)
  })

  test('does not mutate the context passed in when options.root is true', () => {
    const { tracer } = makeTracer()
    const parent = tracer.startSpan('parent', {}, ROOT_CONTEXT)
    const parentCtx = trace.setSpan(ROOT_CONTEXT, parent)
    tracer.startSpan('child', { root: true }, parentCtx)
    assert.equal(trace.getSpan(parentCtx), parent)
  })

  test('returns a non-recording span when tracing is suppressed', () => {
    const { processor, tracer } = makeTracer()
    const suppressedCtx = ROOT_CONTEXT.setValue(SUPPRESS_TRACING_KEY, true)
    const span = tracer.startSpan('op', {}, suppressedCtx)
    assert.ok(!(span instanceof NrSpan))
    assert.equal(span.isRecording(), false)
    assert.equal(processor.calls.onStart.length, 0)
  })

  test('does not treat a falsy suppress-tracing value as suppressed', () => {
    const { tracer } = makeTracer()
    const ctx = ROOT_CONTEXT.setValue(SUPPRESS_TRACING_KEY, false)
    const span = tracer.startSpan('op', {}, ctx)
    assert.ok(span instanceof NrSpan)
  })

  test('starts a new trace when the parent span context is invalid', () => {
    const { tracer } = makeTracer()
    const invalidCtx = trace.setSpanContext(ROOT_CONTEXT, {
      traceId: '0'.repeat(32),
      spanId: '0'.repeat(16),
      traceFlags: 1
    })
    const span = tracer.startSpan('op', {}, invalidCtx)
    assert.notEqual(span.spanContext().traceId, '0'.repeat(32))
    assert.equal(span.parentSpanId, undefined)
  })

  test('preserves traceState from parent context on a non-recording span', () => {
    const { tracer } = makeTracer(SamplingDecision.NOT_RECORD)
    const traceState = { serialize: () => 'foo=bar' }
    const parentCtx = trace.setSpanContext(ROOT_CONTEXT, {
      traceId: 'a'.repeat(32),
      spanId: 'b'.repeat(16),
      traceFlags: 1,
      traceState
    })
    const span = tracer.startSpan('op', {}, parentCtx)
    assert.strictEqual(span.spanContext().traceState, traceState)
  })
})

describe('startActiveSpan', () => {
  test('(name, fn) calls fn with the span', (t, end) => {
    const { tracer } = makeTracer()
    tracer.startActiveSpan('op', (span) => {
      assert.ok(span instanceof NrSpan)
      end()
    })
  })

  test('(name, opts, fn) passes options to startSpan', (t, end) => {
    const { tracer } = makeTracer()
    tracer.startActiveSpan('op', { kind: SpanKind.CLIENT }, (span) => {
      assert.equal(span.kind, SpanKind.CLIENT)
      end()
    })
  })

  test('(name, opts, ctx, fn) uses the provided context', (t, end) => {
    const { tracer } = makeTracer()
    const parent = tracer.startSpan('parent', {}, ROOT_CONTEXT)
    const parentCtx = trace.setSpan(ROOT_CONTEXT, parent)
    tracer.startActiveSpan('child', {}, parentCtx, (span) => {
      assert.equal(span.parentSpanId, parent.spanContext().spanId)
      end()
    })
  })

  test('calls context.with so the span is in scope during fn', (t, end) => {
    // Unit tests run with NoopContextManager so context.active() won't reflect
    // changes — verify that context.with is called with a context that contains
    // the new span, without relying on context.active() propagating correctly.
    const { tracer } = makeTracer()
    let ctxPassedToWith
    const origWith = context.with.bind(context)
    context.with = function spyWith(ctx, fn, thisArg, ...args) {
      ctxPassedToWith = ctx
      return origWith(ctx, fn, thisArg, ...args)
    }
    tracer.startActiveSpan('op', (span) => {
      assert.strictEqual(trace.getSpan(ctxPassedToWith), span)
      context.with = origWith
      end()
    })
  })
})
