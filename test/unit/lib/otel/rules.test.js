/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Based upon https://github.com/open-telemetry/opentelemetry-js/blob/8fc76896595aac912bf9e15d4f19c167317844c8/packages/opentelemetry-sdk-trace-base/test/common/Span.test.ts#L851

const test = require('node:test')
const assert = require('node:assert')

const { ROOT_CONTEXT, SpanKind, TraceFlags } = require('@opentelemetry/api')
const { BasicTracerProvider, Span } = require('@opentelemetry/sdk-trace-base')
const { RulesEngine } = require('../../../../lib/otel/rules.js')

const tracer = new BasicTracerProvider().getTracer('default')
const spanContext = {
  traceId: 'd4cda95b652f4a1592b449d5929fda1b',
  spanId: '6e0c63257de34c92',
  traceFlags: TraceFlags.SAMPLED
}
const parentId = '5c1c63257de34c67'

test('engine returns correct matching rule', () => {
  const engine = new RulesEngine()
  const span = new Span(tracer, ROOT_CONTEXT, 'test-span', spanContext, SpanKind.SERVER, parentId)
  span.setAttribute('http.request.method', 'GET')
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'OtelHttpServer1_23')
})

test('consumer does not match fallback rule', () => {
  const engine = new RulesEngine()
  const span = new Span(tracer, ROOT_CONTEXT, 'test-span', spanContext, SpanKind.CONSUMER, parentId)
  span.setAttribute('messaging.operation', 'create')
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'OtelMessagingConsumer1_24')
})

test('fallback server rule is met', () => {
  const engine = new RulesEngine()
  const span = new Span(tracer, ROOT_CONTEXT, 'test-span', spanContext, SpanKind.SERVER, parentId)
  span.setAttribute('foo.bar', 'baz')
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'FallbackServer')
})

test('fallback client rule is met', () => {
  const engine = new RulesEngine()
  const span = new Span(tracer, ROOT_CONTEXT, 'test-span', spanContext, SpanKind.CLIENT, parentId)
  span.setAttribute('foo.bar', 'baz')
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'FallbackClient')
})

test('fallback producer rule is met', () => {
  const engine = new RulesEngine()
  const span = new Span(tracer, ROOT_CONTEXT, 'test-span', spanContext, SpanKind.PRODUCER, parentId)
  span.setAttribute('foo.bar', 'baz')
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'FallbackProducer')
})

test('fallback internal rule is met', () => {
  const engine = new RulesEngine()
  const span = new Span(tracer, ROOT_CONTEXT, 'test-span', spanContext, SpanKind.INTERNAL, parentId)
  span.setAttribute('foo.bar', 'baz')
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'Fallback')
})
