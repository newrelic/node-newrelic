/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const helper = require('../../lib/agent_helper')
const otel = require('@opentelemetry/api')
const { hrTimeToMilliseconds } = require('@opentelemetry/core')
const { otelSynthesis } = require('../../../lib/symbols')
const { SEMATTRS_HTTP_HOST, SEMATTRS_HTTP_METHOD } = require('@opentelemetry/semantic-conventions')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent({
    feature_flag: {
      opentelemetry_bridge: true
    }
  })
  const api = helper.getAgentApi()
  const tracer = otel.trace.getTracer('hello-world')
  ctx.nr = { agent, api, tracer }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
  // disable all global constructs from trace sdk
  otel.trace.disable()
  otel.context.disable()
  otel.propagation.disable()
  otel.diag.disable()
})

test('Otel internal and NR span tests', (t, end) => {
  const { agent, api, tracer } = t.nr
  function main(mainSegment) {
    tracer.startActiveSpan('hi', (span) => {
      const segment = agent.tracer.getSegment()
      assert.equal(segment.name, span.name)
      assert.equal(segment.parentId, mainSegment.id)
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
    })

    api.startSegment('agentSegment', true, () => {
      const parentSegment = agent.tracer.getSegment()
      tracer.startActiveSpan('bye', (span) => {
        const segment = agent.tracer.getSegment()
        assert.equal(segment.name, span.name)
        assert.equal(segment.parentId, parentSegment.id)
        span.end()
        const duration = hrTimeToMilliseconds(span.duration)
        assert.equal(duration, segment.getDurationInMillis())
      })
    })
  }
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'otel-example-tx'
    tracer.startActiveSpan('main', (span) => {
      const segment = agent.tracer.getSegment()
      main(segment)
      span.end()
      assert.equal(span[otelSynthesis], undefined)
      assert.equal(segment.name, span.name)
      assert.equal(segment.parentId, tx.trace.root.id)
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
      const metrics = tx.metrics.scoped[tx.name]
      assert.equal(metrics['Custom/main'].callCount, 1)
      assert.equal(metrics['Custom/hi'].callCount, 1)
      assert.equal(metrics['Custom/bye'].callCount, 1)
      const unscopedMetrics = tx.metrics.unscoped
      assert.equal(unscopedMetrics['Custom/main'].callCount, 1)
      assert.equal(unscopedMetrics['Custom/hi'].callCount, 1)
      assert.equal(unscopedMetrics['Custom/bye'].callCount, 1)
      end()
    })
  })
})

test('Otel http external span test', (t, end) => {
  const { agent, tracer } = t.nr
  helper.runInTransaction(agent, (tx) => {
    tx.name = 'http-external-test'
    tracer.startActiveSpan('http-outbound', { kind: otel.SpanKind.CLIENT, attributes: { [SEMATTRS_HTTP_HOST]: 'newrelic.com', [SEMATTRS_HTTP_METHOD]: 'GET' } }, (span) => {
      const segment = agent.tracer.getSegment()
      assert.equal(segment.name, 'External/newrelic.com')
      span.end()
      const duration = hrTimeToMilliseconds(span.duration)
      assert.equal(duration, segment.getDurationInMillis())
      tx.end()
      const metrics = tx.metrics.scoped[tx.name]
      assert.equal(metrics['External/newrelic.com/http'].callCount, 1)
      const unscopedMetrics = tx.metrics.unscoped
      assert.equal(unscopedMetrics['External/newrelic.com/http'].callCount, 1)
      assert.equal(unscopedMetrics['External/newrelic.com/all'].callCount, 1)
      assert.equal(unscopedMetrics['External/all'].callCount, 1)
      assert.equal(unscopedMetrics['External/allWeb'].callCount, 1)
      end()
    })
  })
})
