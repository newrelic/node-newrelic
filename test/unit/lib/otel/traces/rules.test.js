/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Based upon https://github.com/open-telemetry/opentelemetry-js/blob/8fc76896595aac912bf9e15d4f19c167317844c8/packages/opentelemetry-sdk-trace-base/test/common/Span.test.ts#L851

const test = require('node:test')
const assert = require('node:assert')

const { ROOT_CONTEXT, SpanKind } = require('@opentelemetry/api')
const { BasicTracerProvider } = require('@opentelemetry/sdk-trace-base')
const { RulesEngine } = require('#agentlib/otel/traces/rules.js')

const tracer = new BasicTracerProvider().getTracer('default')

test('engine returns correct matching rule', () => {
  const engine = new RulesEngine()
  const span = tracer.startSpan('test-span', { kind: SpanKind.SERVER }, ROOT_CONTEXT)
  span.setAttribute('http.request.method', 'GET')
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'OtelHttpServer1_23')
})

test('consumer does not match fallback rule', () => {
  const engine = new RulesEngine()
  const span = tracer.startSpan('test-span', { kind: SpanKind.CONSUMER }, ROOT_CONTEXT)
  span.setAttribute('messaging.operation', 'create')
  span.setAttribute('messaging.system', 'rabbitmq')
  span.setAttribute('messaging.destination.name', 'test-queue')
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'OtelMessagingConsumer1_24')
})

test('consumer matches fallback rule', () => {
  const engine = new RulesEngine()
  const span = tracer.startSpan('test-span', { kind: SpanKind.CONSUMER }, ROOT_CONTEXT)
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'FallbackConsumer')
})

test('fallback server rule is met', () => {
  const engine = new RulesEngine()
  const span = tracer.startSpan('test-span', { kind: SpanKind.SERVER }, ROOT_CONTEXT)
  span.setAttribute('foo.bar', 'baz')
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'FallbackServer')
})

test('fallback client rule is met', () => {
  const engine = new RulesEngine()
  const span = tracer.startSpan('test-span', { kind: SpanKind.CLIENT }, ROOT_CONTEXT)
  span.setAttribute('foo.bar', 'baz')
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'FallbackClient')
})

test('fallback producer rule is met', () => {
  const engine = new RulesEngine()
  const span = tracer.startSpan('test-span', { kind: SpanKind.PRODUCER }, ROOT_CONTEXT)
  span.setAttribute('foo.bar', 'baz')
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'FallbackProducer')
})

test('fallback internal rule is met', () => {
  const engine = new RulesEngine()
  const span = tracer.startSpan('test-span', { kind: SpanKind.INTERNAL }, ROOT_CONTEXT)
  span.setAttribute('foo.bar', 'baz')
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'Fallback')
})

test('scope_name rule is met', () => {
  const engine = new RulesEngine()
  const span = tracer.startSpan('test-span', { kind: SpanKind.CLIENT }, ROOT_CONTEXT)
  span.setAttribute('db.system.name', 'postgresql')
  span.instrumentationScope = { name: 'prisma' }
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'OtelDbClientPrisma1_40')
})

test('scope_version matching rule is met', () => {
  const rule = {
    name: 'test-rule',
    type: 'db',
    matcher: {
      required_span_kinds: ['client'],
      required_attribute_keys: ['db.system'],
      scope_version: '^1.0.0'
    },
    attributes: [{
      key: 'db.system',
      target: 'segment',
      name: 'product'
    }]
  }
  const engine = new RulesEngine({ rules: [rule] })
  const span = tracer.startSpan('test-span', { kind: SpanKind.CLIENT }, ROOT_CONTEXT)
  span.setAttribute('db.system', 'test-db')
  span.instrumentationScope = { version: '1.2.3' }
  span.end()

  const foundRule = engine.test(span)
  assert.notEqual(foundRule, undefined)
  assert.equal(foundRule.name, rule.name)
})
