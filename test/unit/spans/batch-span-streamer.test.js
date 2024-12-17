/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const sinon = require('sinon')
const SpanStreamerEvent = require('../../../lib/spans/streaming-span-event.js')
const METRIC_NAMES = require('../../../lib/metrics/names')
const { createFakeConnection, createMetricAggregator } = require('./span-streamer-helpers')
const BatchSpanStreamer = require('../../../lib/spans/batch-span-streamer')

test('BatchSpanStreamer', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const fakeConnection = createFakeConnection()

    ctx.nr.spanStreamer = new BatchSpanStreamer(
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

  await t.test('should create a spanStreamer instance', (t) => {
    const { spanStreamer } = t.nr
    assert.ok(spanStreamer, 'instantiated the object')
  })

  await t.test('should setup flush queue for every 5 seconds on connect', (t) => {
    const { fakeConnection, spanStreamer } = t.nr
    assert.ok(spanStreamer.sendTimer)
    assert.ok(!spanStreamer.sendTimer._destroyed)
    fakeConnection.disconnect()
    assert.ok(spanStreamer.sendTimer._destroyed)
  })

  await t.test('Should increment SEEN metric on write', (t) => {
    const { spanStreamer } = t.nr
    const metricsSpy = sinon.spy(spanStreamer._metrics, 'getOrCreateMetric')
    const fakeSpan = new SpanStreamerEvent('sandwich', {}, {})
    spanStreamer.write(fakeSpan)

    assert.ok(metricsSpy.firstCall.calledWith(METRIC_NAMES.INFINITE_TRACING.SEEN), 'SEEN metric')
  })

  await t.test('Should add span to queue on backpressure', (t) => {
    const { spanStreamer } = t.nr
    spanStreamer._writable = false
    assert.equal(spanStreamer.spans.length, 0, 'no spans queued')
    const fakeSpan = new SpanStreamerEvent('sandwich', {}, {})
    spanStreamer.write(fakeSpan)

    assert.equal(spanStreamer.spans.length, 1, 'one span queued')
  })

  await t.test('Should drain span queue on stream drain event', (t) => {
    const { fakeConnection, spanStreamer } = t.nr
    /* simulate backpressure */
    fakeConnection.stream.write = () => false
    spanStreamer.queue_size = 1
    const metrics = spanStreamer._metrics

    assert.equal(spanStreamer.spans.length, 0, 'no spans queued')
    const fakeSpan = {
      toStreamingFormat: () => {}
    }

    spanStreamer.write(fakeSpan)
    spanStreamer.write(fakeSpan)

    assert.equal(spanStreamer.spans.length, 1, 'one span queued')

    /* emit drain event and allow writes */
    spanStreamer.stream.emit('drain', (fakeConnection.stream.write = () => true))

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

    const fakeSpan = new SpanStreamerEvent('sandwich', {}, {})
    const fakeSpanQueued = new SpanStreamerEvent('porridge', {}, {})

    spanStreamer.write(fakeSpan)
    spanStreamer.write(fakeSpanQueued)

    assert.equal(spanStreamer.spans.length, 1, 'one span queued')

    // emit drain event, allow writes and check for span.trace_id
    fakeConnection.stream.emit(
      'drain',
      (fakeConnection.stream.write = ({ spans }) => {
        const [span] = spans
        assert.equal(span.trace_id, 'porridge', 'Should have formatted span')

        return true
      })
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

  await t.test('should send a batch if it exceeds queue', (t, end) => {
    const { fakeConnection, spanStreamer } = t.nr
    const metrics = spanStreamer._metrics

    let i = 0
    fakeConnection.stream.write = ({ spans }) => {
      i++
      if (i === 1) {
        const [span, span2] = spans
        assert.equal(span.trace_id, 'sandwich', 'batch 1 span 1 ok')
        assert.equal(span2.trace_id, 'porridge', 'batch 1 span 2 ok')
      } else {
        const [span, span2] = spans
        assert.equal(span.trace_id, 'arepa', 'batch 2 span 1 ok')
        assert.equal(span2.trace_id, 'hummus', 'batch 2 span 2 ok')
        end()
      }

      return true
    }

    assert.equal(spanStreamer.spans.length, 0, 'no spans queued')

    const fakeSpan = new SpanStreamerEvent('sandwich', {}, {})
    const fakeSpan2 = new SpanStreamerEvent('porridge', {}, {})
    const fakeSpan3 = new SpanStreamerEvent('arepa', {}, {})
    const fakeSpan4 = new SpanStreamerEvent('hummus', {}, {})

    spanStreamer.write(fakeSpan)
    assert.equal(spanStreamer.spans.length, 1, '1 span in queue')

    spanStreamer.write(fakeSpan2)

    assert.equal(spanStreamer.spans.length, 0, '0 spans in queue')
    assert.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.SENT).callCount,
      2,
      'SENT metric incremented to 2'
    )

    spanStreamer.write(fakeSpan3)

    assert.equal(spanStreamer.spans.length, 1, '1 span in queue')

    spanStreamer.write(fakeSpan4)

    assert.equal(spanStreamer.spans.length, 0, '0 spans in queue')
    assert.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.SENT).callCount,
      4,
      'SENT metric incremented to 4'
    )
  })

  await t.test('should send in appropriate batch sizes', (t) => {
    const { fakeConnection, spanStreamer } = t.nr
    // this will simulate n full batches and the last batch being 1/3 full
    const SPANS = 10000
    const BATCH = 750
    const metrics = spanStreamer._metrics
    spanStreamer.batchSize = BATCH
    spanStreamer.queue_size = SPANS
    let i = 0
    fakeConnection.stream.write = ({ spans }) => {
      if (i === 13) {
        assert.equal(spans.length, BATCH / 3)
      } else {
        assert.equal(spans.length, BATCH)
      }
      i++
      return true
    }

    const spans = Array(SPANS).fill(new SpanStreamerEvent('trace_id', {}, {}))
    spans.forEach((span) => {
      spanStreamer.write(span)
    })
    assert.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.SENT).callCount,
      SPANS,
      `SENT metric incremented to ${SPANS}`
    )
  })
})
