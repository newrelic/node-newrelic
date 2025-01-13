/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const SpanStreamerEvent = require('../../../lib/spans/streaming-span-event.js')
const METRIC_NAMES = require('../../../lib/metrics/names')
const { createFakeConnection, createMetricAggregator } = require('./span-streamer-helpers')
const SpanStreamer = require('../../../lib/spans/span-streamer')
const fakeSpan = {
  toStreamingFormat: () => {}
}

test('SpanStreamer', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const fakeConnection = createFakeConnection()
    ctx.nr.spanStreamer = new SpanStreamer(
      'fake-license-key',
      fakeConnection,
      createMetricAggregator(),
      2
    )
    fakeConnection.connectSpans()
    ctx.nr.fakeConnection = fakeConnection
  })

  t.afterEach((ctx) => {
    const { spanStreamer } = ctx.nr
    if (spanStreamer.stream) {
      spanStreamer.stream.destroy()
    }
  })

  await t.test((t) => {
    const { spanStreamer } = t.nr
    assert.ok(spanStreamer, 'instantiated the object')
  })

  await t.test('Should increment SEEN metric on write', (t) => {
    const { spanStreamer } = t.nr
    const metricsSpy = sinon.spy(spanStreamer._metrics, 'getOrCreateMetric')
    spanStreamer.write(fakeSpan)

    assert.ok(metricsSpy.firstCall.calledWith(METRIC_NAMES.INFINITE_TRACING.SEEN), 'SEEN metric')
  })

  await t.test('Should add span to queue on backpressure', (t) => {
    const { spanStreamer } = t.nr
    spanStreamer._writable = false
    assert.equal(spanStreamer.spans.length, 0, 'no spans queued')
    spanStreamer.write({})

    assert.equal(spanStreamer.spans.length, 1, 'one span queued')
  })

  await t.test('Should drain span queue on stream drain event', (t) => {
    const { fakeConnection, spanStreamer } = t.nr
    /* simulate backpressure */
    fakeConnection.stream.write = () => false
    spanStreamer.queue_size = 1
    const metrics = spanStreamer._metrics

    assert.equal(spanStreamer.spans.length, 0, 'no spans queued')
    spanStreamer.write(fakeSpan)
    spanStreamer.write(fakeSpan)

    assert.equal(spanStreamer.spans.length, 1, 'one span queued')

    /* emit drain event and allow writes */
    fakeConnection.stream.write = () => true
    fakeConnection.stream.emit('drain', fakeConnection.stream.write)

    assert.equal(spanStreamer.spans.length, 0, 'drained spans')
    assert.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.DRAIN_DURATION).callCount,
      1,
      'DRAIN_DURATION metric'
    )

    assert.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.SENT).callCount,
      2,
      'SENT metric incremented'
    )
  })

  await t.test('Should properly format spans sent from the queue', (t) => {
    const { fakeConnection, spanStreamer } = t.nr
    /* simulate backpressure */
    fakeConnection.stream.write = () => false
    spanStreamer.queue_size = 1
    const metrics = spanStreamer._metrics
    assert.equal(spanStreamer.spans.length, 0, 'no spans queued')

    const fakeSpan1 = new SpanStreamerEvent('sandwich', {}, {})
    const fakeSpanQueued = new SpanStreamerEvent('porridge', {}, {})

    spanStreamer.write(fakeSpan1)
    spanStreamer.write(fakeSpanQueued)

    assert.equal(spanStreamer.spans.length, 1, 'one span queued')

    /* emit drain event, allow writes and check for span.trace_id */
    fakeConnection.stream.write = (span) => {
      assert.equal(span.trace_id, 'porridge', 'Should have formatted span')

      return true
    }
    fakeConnection.stream.emit(
      'drain',
      fakeConnection.stream.write
    )

    assert.equal(spanStreamer.spans.length, 0, 'drained spans')
    assert.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.DRAIN_DURATION).callCount,
      1,
      'DRAIN_DURATION metric'
    )

    assert.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.SENT).callCount,
      2,
      'SENT metric incremented'
    )
  })
})
