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
const { RulesEngine } = require('./rules.js')

const tracer = new BasicTracerProvider().getTracer('default')
const spanContext = {
  traceId: 'd4cda95b652f4a1592b449d5929fda1b',
  spanId: '6e0c63257de34c92',
  traceFlags: TraceFlags.SAMPLED
}

test('engine returns correct matching rule', () => {
  const engine = new RulesEngine()
  const parentId = '5c1c63257de34c67'
  const span = new Span(tracer, ROOT_CONTEXT, 'test-span', spanContext, SpanKind.SERVER, parentId)
  span.setAttribute('http.request.method', 'GET')
  span.end()

  const rule = engine.test(span)
  assert.notEqual(rule, undefined)
  assert.equal(rule.name, 'OtelHttpServer1_23')
})
