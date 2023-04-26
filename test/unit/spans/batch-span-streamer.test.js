/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const sinon = require('sinon')
const GrpcConnection = require('../../../lib/grpc/connection')
const SpanStreamerEvent = require('../../../lib/spans/streaming-span-event.js')
const { EventEmitter } = require('events')
const METRIC_NAMES = require('../../../lib/metrics/names')
const loggerParent = require('../../../lib/logger')
const { createMetricAggregator } = require('./span-streamer-helpers')

const fakeLogger = {
  info: () => {},
  debug: () => {},
  trace: () => {},
  error: () => {},
  warnOnce: () => {},
  infoOncePer: () => {},
  options: {
    _level: 100
  }
}

/**
 * return fakeLogger from loggerParent dependency and must be setup before
 * requiring span-streamer
 */
sinon.stub(loggerParent, 'child').returns(fakeLogger)

const BatchSpanStreamer = require('../../../lib/spans/batch-span-streamer')
const realStream = require('stream')
const mockedStream = realStream.Writable

mockedStream._write = () => true

/**
 * A mocked connection object
 *
 * Exists to give tests an EventEmitter
 * compatible object and mock out internal
 * functions so they don't fail
 */
class MockConnection extends EventEmitter {
  /**
   * Called by span streamer's connect method
   *
   * Mocked here to ensure calls to connect don't crash
   */
  setConnectionDetails() {}

  connectSpans() {
    this.stream = this.stream ? this.stream : mockedStream
    this.emit('connected', this.stream)
  }

  disconnect() {
    this.emit('disconnected')
  }

  /* method for testing only */
  setStream(stream) {
    this.stream = stream
  }
}

/**
 * Creates a fake/mocked connection
 *
 * This is the base fake connection class -- each test
 * may add additional methods to the object as needed.
 */
const createFakeConnection = () => {
  return new MockConnection()
}

tap.test((t) => {
  const metrics = createMetricAggregator()
  const spanStreamer = new BatchSpanStreamer(
    'fake-license-key',
    new GrpcConnection({ trace_observer: {} }, metrics)
  )

  t.ok(spanStreamer, 'instantiated the object')
  t.end()
})

tap.test('should setup flush queue for every 5 seconds on connect', (t) => {
  const metrics = createMetricAggregator()
  const fakeConnection = createFakeConnection()
  const spanStreamer = new BatchSpanStreamer('fake-license-key', fakeConnection, metrics)
  fakeConnection.connectSpans()

  t.ok(spanStreamer, 'instantiated the object')
  t.ok(spanStreamer.sendTimer)
  t.notOk(spanStreamer.sendTimer._destroyed)
  fakeConnection.disconnect()
  t.ok(spanStreamer.sendTimer._destroyed)
  t.end()
})

tap.test('Should increment SEEN metric on write', (t) => {
  const metrics = createMetricAggregator()
  const metricsSpy = sinon.spy(metrics, 'getOrCreateMetric')

  const spanStreamer = new BatchSpanStreamer('fake-license-key', createFakeConnection(), metrics)

  spanStreamer.write({})

  t.ok(metricsSpy.firstCall.calledWith(METRIC_NAMES.INFINITE_TRACING.SEEN), 'SEEN metric')

  t.end()
})

tap.test('Should add span to queue on backpressure', (t) => {
  const fakeConnection = createFakeConnection()

  const spanStreamer = new BatchSpanStreamer(
    'fake-license-key',
    fakeConnection,
    createMetricAggregator(),
    2
  )
  fakeConnection.connectSpans()

  spanStreamer._writable = false
  t.equal(spanStreamer.spans.length, 0, 'no spans queued')
  const fakeSpan = new SpanStreamerEvent('sandwich', {}, {})
  spanStreamer.write(fakeSpan)

  t.equal(spanStreamer.spans.length, 1, 'one span queued')

  t.end()
})

tap.test('Should drain span queue on stream drain event', (t) => {
  const fakeConnection = createFakeConnection()
  const metrics = createMetricAggregator()

  /* use PassThrough stream for drain emit */
  const { PassThrough } = require('stream')
  const fakeStream = new PassThrough()

  /* simulate backpressure */
  fakeStream.write = () => false

  fakeConnection.setStream(fakeStream)

  const spanStreamer = new BatchSpanStreamer('fake-license-key', fakeConnection, metrics, 1)

  fakeConnection.connectSpans()

  t.equal(spanStreamer.spans.length, 0, 'no spans queued')
  const fakeSpan = {
    toStreamingFormat: () => {}
  }

  spanStreamer.write(fakeSpan)
  spanStreamer.write(fakeSpan)

  t.equal(spanStreamer.spans.length, 1, 'one span queued')

  /* emit drain event and allow writes */
  fakeStream.emit('drain', (fakeStream.write = () => true))

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

  fakeStream.destroy()

  t.end()
})

tap.test('Should properly format spans sent from the queue', (t) => {
  const fakeConnection = createFakeConnection()
  const metrics = createMetricAggregator()

  const { PassThrough } = require('stream')
  const fakeStream = new PassThrough()

  // simulate backpressure
  fakeStream.write = () => false

  fakeConnection.setStream(fakeStream)

  const spanStreamer = new BatchSpanStreamer('fake-license-key', fakeConnection, metrics, 1)

  fakeConnection.connectSpans()

  t.equal(spanStreamer.spans.length, 0, 'no spans queued')

  const fakeSpan = new SpanStreamerEvent('sandwich', {}, {})
  const fakeSpanQueued = new SpanStreamerEvent('porridge', {}, {})

  spanStreamer.write(fakeSpan)
  spanStreamer.write(fakeSpanQueued)

  t.equal(spanStreamer.spans.length, 1, 'one span queued')

  // emit drain event, allow writes and check for span.trace_id
  fakeStream.emit(
    'drain',
    (fakeStream.write = ({ spans }) => {
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

  fakeStream.destroy()

  t.end()
})

tap.test('should send a batch if it exceeds queue', (t) => {
  const fakeConnection = createFakeConnection()
  const metrics = createMetricAggregator()

  // use PassThrough stream for drain emit
  const { PassThrough } = require('stream')
  const fakeStream = new PassThrough()
  let i = 0
  fakeStream.write = ({ spans }) => {
    i++
    if (i === 1) {
      const [span, span2] = spans
      t.equal(span.trace_id, 'sandwich', 'Should have formatted span')
      t.equal(span2.trace_id, 'porridge')
    } else {
      const [span, span2] = spans
      t.equal(span.trace_id, 'arepa', 'Should have formatted span')
      t.equal(span2.trace_id, 'hummus')
    }

    return true
  }
  fakeConnection.setStream(fakeStream)

  const spanStreamer = new BatchSpanStreamer('fake-license-key', fakeConnection, metrics, 2)

  fakeConnection.connectSpans()

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
    'SENT metric incremented'
  )

  spanStreamer.write(fakeSpan3)

  t.equal(spanStreamer.spans.length, 1, '1 span in queue')

  spanStreamer.write(fakeSpan4)

  t.equal(spanStreamer.spans.length, 0, '0 spans in queue')
  t.equal(
    metrics.getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.SENT).callCount,
    4,
    'SENT metric incremented'
  )

  fakeStream.destroy()

  t.end()
})
