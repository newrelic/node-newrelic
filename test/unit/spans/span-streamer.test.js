/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const sinon = require('sinon')
const SpanStreamerEvent = require('../../../lib/spans/streaming-span-event.js')
const METRIC_NAMES = require('../../../lib/metrics/names')
const { createFakeConnection, createMetricAggregator } = require('./span-streamer-helpers')
const SpanStreamer = require('../../../lib/spans/span-streamer')
const fakeSpan = {
  toStreamingFormat: () => {}
}

tap.test('SpanStreamer', (t) => {
  t.autoend()
  let fakeConnection
  let spanStreamer

  t.beforeEach(() => {
    fakeConnection = createFakeConnection()

    spanStreamer = new SpanStreamer('fake-license-key', fakeConnection, createMetricAggregator(), 2)
    fakeConnection.connectSpans()
  })

  t.afterEach(() => {
    if (spanStreamer.stream) {
      spanStreamer.stream.destroy()
    }
  })

  t.test((t) => {
    t.ok(spanStreamer, 'instantiated the object')
    t.end()
  })

  t.test('Should increment SEEN metric on write', (t) => {
    const metricsSpy = sinon.spy(spanStreamer._metrics, 'getOrCreateMetric')
    spanStreamer.write(fakeSpan)

    t.ok(metricsSpy.firstCall.calledWith(METRIC_NAMES.INFINITE_TRACING.SEEN), 'SEEN metric')

    t.end()
  })

  t.test('Should add span to queue on backpressure', (t) => {
    spanStreamer._writable = false
    t.equal(spanStreamer.spans.length, 0, 'no spans queued')
    spanStreamer.write({})

    t.equal(spanStreamer.spans.length, 1, 'one span queued')

    t.end()
  })

  t.test('Should drain span queue on stream drain event', (t) => {
    /* simulate backpressure */
    fakeConnection.stream.write = () => false
    spanStreamer.queue_size = 1
    const metrics = spanStreamer._metrics

    t.equal(spanStreamer.spans.length, 0, 'no spans queued')
    spanStreamer.write(fakeSpan)
    spanStreamer.write(fakeSpan)

    t.equal(spanStreamer.spans.length, 1, 'one span queued')

    /* emit drain event and allow writes */
    fakeConnection.stream.emit('drain', (fakeConnection.stream.write = () => true))

    t.equal(spanStreamer.spans.length, 0, 'drained spans')
    t.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.DRAIN_DURATION).callCount,
      1,
      'DRAIN_DURATION metric'
    )

    t.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.SENT).callCount,
      2,
      'SENT metric incremented'
    )

    t.end()
  })

  t.test('Should properly format spans sent from the queue', (t) => {
    /* simulate backpressure */
    fakeConnection.stream.write = () => false
    spanStreamer.queue_size = 1
    const metrics = spanStreamer._metrics
    t.equal(spanStreamer.spans.length, 0, 'no spans queued')

    const fakeSpan1 = new SpanStreamerEvent('sandwich', {}, {})
    const fakeSpanQueued = new SpanStreamerEvent('porridge', {}, {})

    spanStreamer.write(fakeSpan1)
    spanStreamer.write(fakeSpanQueued)

    t.equal(spanStreamer.spans.length, 1, 'one span queued')

    /* emit drain event, allow writes and check for span.trace_id */
    fakeConnection.stream.emit(
      'drain',
      (fakeConnection.stream.write = (span) => {
        t.equal(span.trace_id, 'porridge', 'Should have formatted span')

        return true
      })
    )

    t.equal(spanStreamer.spans.length, 0, 'drained spans')
    t.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.DRAIN_DURATION).callCount,
      1,
      'DRAIN_DURATION metric'
    )

    t.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.SENT).callCount,
      2,
      'SENT metric incremented'
    )

    t.end()
  })
})
