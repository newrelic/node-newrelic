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

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent({
    feature_flag: {
      otel_bridge: true
    }
  })
  const api = helper.getAgentApi()
  const tracer = otel.trace.getTracer('hello-world')
  ctx.nr = { agent, api, tracer }
})

test('Otel span tests', (t, end) => {
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
