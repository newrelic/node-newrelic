/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const sinon = require('sinon')
const SpanStreamerEvent = require('../../../lib/spans/streaming-span-event.js')
const METRIC_NAMES = require('../../../lib/metrics/names')
const { createFakeConnection, createMetricAggregator } = require('./span-streamer-helpers')
const BatchSpanStreamer = require('../../../lib/spans/batch-span-streamer')

tap.test('BatchSpanStreamer', (t) => {
  t.autoend()
  let fakeConnection
  let spanStreamer

  t.beforeEach(() => {
    fakeConnection = createFakeConnection()

    spanStreamer = new BatchSpanStreamer(
      'fake-license-key',
      fakeConnection,
      createMetricAggregator(),
      2
    )
    fakeConnection.connectSpans()
  })

  t.afterEach(() => {
    if (spanStreamer.stream) {
      spanStreamer.stream.destroy()
    }
  })

  t.test('should create a spanStreamer instance', (t) => {
    t.ok(spanStreamer, 'instantiated the object')
    t.end()
  })

  t.test('should setup flush queue for every 5 seconds on connect', (t) => {
    t.ok(spanStreamer.sendTimer)
    t.notOk(spanStreamer.sendTimer._destroyed)
    fakeConnection.disconnect()
    t.ok(spanStreamer.sendTimer._destroyed)
    t.end()
  })

  t.test('Should increment SEEN metric on write', (t) => {
    const metricsSpy = sinon.spy(spanStreamer._metrics, 'getOrCreateMetric')
    const fakeSpan = new SpanStreamerEvent('sandwich', {}, {})
    spanStreamer.write(fakeSpan)

    t.ok(metricsSpy.firstCall.calledWith(METRIC_NAMES.INFINITE_TRACING.SEEN), 'SEEN metric')

    t.end()
  })

  t.test('Should add span to queue on backpressure', (t) => {
    spanStreamer._writable = false
    t.equal(spanStreamer.spans.length, 0, 'no spans queued')
    const fakeSpan = new SpanStreamerEvent('sandwich', {}, {})
    spanStreamer.write(fakeSpan)

    t.equal(spanStreamer.spans.length, 1, 'one span queued')

    t.end()
  })

  t.test('Should drain span queue on stream drain event', (t) => {
    /* simulate backpressure */
    fakeConnection.stream.write = () => false
    spanStreamer.queue_size = 1
    const metrics = spanStreamer._metrics

    t.equal(spanStreamer.spans.length, 0, 'no spans queued')
    const fakeSpan = {
      toStreamingFormat: () => {}
    }

    spanStreamer.write(fakeSpan)
    spanStreamer.write(fakeSpan)

    t.equal(spanStreamer.spans.length, 1, 'one span queued')

    /* emit drain event and allow writes */
    spanStreamer.stream.emit('drain', (fakeConnection.stream.write = () => true))

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

    const fakeSpan = new SpanStreamerEvent('sandwich', {}, {})
    const fakeSpanQueued = new SpanStreamerEvent('porridge', {}, {})

    spanStreamer.write(fakeSpan)
    spanStreamer.write(fakeSpanQueued)

    t.equal(spanStreamer.spans.length, 1, 'one span queued')

    // emit drain event, allow writes and check for span.trace_id
    fakeConnection.stream.emit(
      'drain',
      (fakeConnection.stream.write = ({ spans }) => {
        const [span] = spans
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

  t.test('should send a batch if it exceeds queue', (t) => {
    t.plan(11)
    const metrics = spanStreamer._metrics

    let i = 0
    fakeConnection.stream.write = ({ spans }) => {
      i++
      if (i === 1) {
        const [span, span2] = spans
        t.equal(span.trace_id, 'sandwich', 'batch 1 span 1 ok')
        t.equal(span2.trace_id, 'porridge', 'batch 1 span 2 ok')
      } else {
        const [span, span2] = spans
        t.equal(span.trace_id, 'arepa', 'batch 2 span 1 ok')
        t.equal(span2.trace_id, 'hummus', 'batch 2 span 2 ok')
      }

      return true
    }

    t.equal(spanStreamer.spans.length, 0, 'no spans queued')

    const fakeSpan = new SpanStreamerEvent('sandwich', {}, {})
    const fakeSpan2 = new SpanStreamerEvent('porridge', {}, {})
    const fakeSpan3 = new SpanStreamerEvent('arepa', {}, {})
    const fakeSpan4 = new SpanStreamerEvent('hummus', {}, {})

    spanStreamer.write(fakeSpan)
    t.equal(spanStreamer.spans.length, 1, '1 span in queue')

    spanStreamer.write(fakeSpan2)

    t.equal(spanStreamer.spans.length, 0, '0 spans in queue')
    t.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.SENT).callCount,
      2,
      'SENT metric incremented to 2'
    )

    spanStreamer.write(fakeSpan3)

    t.equal(spanStreamer.spans.length, 1, '1 span in queue')

    spanStreamer.write(fakeSpan4)

    t.equal(spanStreamer.spans.length, 0, '0 spans in queue')
    t.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.SENT).callCount,
      4,
      'SENT metric incremented to 4'
    )
  })

  t.test('should send in appropriate batch sizes', (t) => {
    t.comment('this will simulate n full batches and the last batch being 1/3 full')
    const SPANS = 10000
    const BATCH = 750
    // set the number of expected assertions to the batches + the sent metric
    t.plan(Math.ceil(SPANS / BATCH) + 1)
    const metrics = spanStreamer._metrics
    spanStreamer.batchSize = BATCH
    spanStreamer.queue_size = SPANS
    let i = 0
    fakeConnection.stream.write = ({ spans }) => {
      if (i === 13) {
        t.equal(spans.length, BATCH / 3)
      } else {
        t.equal(spans.length, BATCH)
      }
      i++
      return true
    }

    const spans = Array(SPANS).fill(new SpanStreamerEvent('trace_id', {}, {}))
    spans.forEach((span) => {
      spanStreamer.write(span)
    })
    t.equal(
      metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.SENT).callCount,
      SPANS,
      `SENT metric incremented to ${SPANS}`
    )
    t.end()
  })
})
