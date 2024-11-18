/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')

const helper = require('../../../lib/agent_helper')
const { ROOT_CONTEXT, SpanKind, TraceFlags } = require('@opentelemetry/api')
const { BasicTracerProvider, Span } = require('@opentelemetry/sdk-trace-base')
const SegmentSynthesizer = require('../../../../lib/otel/segment-synthesis')
const {
  SEMATTRS_DB_SYSTEM,
  SEMATTRS_HTTP_HOST,
  SEMATTRS_HTTP_METHOD
} = require('@opentelemetry/semantic-conventions')
const createMockLogger = require('../../mocks/logger')

test.beforeEach((ctx) => {
  const loggerMock = createMockLogger()
  const agent = helper.loadMockedAgent()
  const synthesizer = new SegmentSynthesizer(agent, { logger: loggerMock })
  const tracer = new BasicTracerProvider().getTracer('default')
  const parentId = '5c1c63257de34c67'
  ctx.nr = {
    agent,
    loggerMock,
    parentId,
    synthesizer,
    tracer
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('should create http external segment from otel http client span', (t, end) => {
  const { agent, synthesizer, parentId, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    const spanContext = {
      traceId: tx.trace.id,
      spanId: tx.trace.root.id,
      traceFlags: TraceFlags.SAMPLED
    }
    const span = new Span(tracer, ROOT_CONTEXT, 'test-span', spanContext, SpanKind.CLIENT, parentId)
    span.setAttribute(SEMATTRS_HTTP_METHOD, 'GET')
    span.setAttribute(SEMATTRS_HTTP_HOST, 'newrelic.com')
    const segment = synthesizer.synthesize(span)
    assert.equal(segment.name, 'External/newrelic.com')
    assert.equal(segment.parentId, tx.trace.root.id)
    tx.end()
    end()
  })
})

test('should log warning if a rule does have a synthesis for the given type', (t, end) => {
  const { agent, synthesizer, loggerMock, parentId, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const spanContext = {
      traceId: tx.trace.id,
      spanId: tx.trace.root.id,
      traceFlags: TraceFlags.SAMPLED
    }
    const span = new Span(tracer, ROOT_CONTEXT, 'test-span', spanContext, SpanKind.CLIENT, parentId)
    span.setAttribute(SEMATTRS_DB_SYSTEM, 'postgres')
    const segment = synthesizer.synthesize(span)
    assert.ok(!segment)
    assert.deepEqual(loggerMock.debug.args[0], [
      'Found type: %s, no synthesize rule currently built',
      'db'
    ])
    tx.end()
    end()
  })
})

test('should log warning span does not match a rule', (t, end) => {
  const { agent, synthesizer, loggerMock, parentId, tracer } = t.nr

  helper.runInTransaction(agent, (tx) => {
    const spanContext = {
      traceId: tx.trace.id,
      spanId: tx.trace.root.id,
      traceFlags: TraceFlags.SAMPLED
    }

    const span = new Span(tracer, ROOT_CONTEXT, 'test-span', spanContext, 'bogus', parentId)
    const segment = synthesizer.synthesize(span)
    assert.ok(!segment)
    assert.deepEqual(loggerMock.debug.args[0], [
      'Cannot match a rule to span name: %s, kind %s',
      'test-span',
      'bogus'
    ])
    tx.end()
    end()
  })
})
