/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const sinon = require('sinon')
const GrpcConnection = require('../../../lib/grpc/connection')
const SpanStreamerEvent = require('../../../lib/spans/streaming-span-event.js')
const MetricAggregator = require('../../../lib/metrics/metric-aggregator')
const MetricMapper = require('../../../lib/metrics/mapper')
const MetricNormalizer = require('../../../lib/metrics/normalizer')
const EventEmitter = require('events').EventEmitter
const METRIC_NAMES = require('../../../lib/metrics/names')
const loggerParent = require('../../../lib/logger')

const fakeLogger = {
  info: () => {},
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

const SpanStreamer = require('../../../lib/spans/span-streamer')


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
  return new MockConnection
}

const createMetricAggregatorForTests = () => {
  const mapper = new MetricMapper()
  const normalizer = new MetricNormalizer({}, 'metric name')

  const metrics = new MetricAggregator(
    {
      // runId: RUN_ID,
      apdexT: 0.5,
      mapper: mapper,
      normalizer: normalizer
    },
    {}
  )
  return metrics
}

tap.test((t)=>{
  const metrics = createMetricAggregatorForTests()
  const spanStreamer = new SpanStreamer(
    'fake-license-key',
    new GrpcConnection({}, metrics)
  )

  t.ok(spanStreamer, "instantiated the object")
  t.end()
})

tap.test('Should increment SEEN metric on write', (t) => {
  const metrics = createMetricAggregatorForTests()
  const metricsSpy = sinon.spy(metrics, 'getOrCreateMetric')

  const spanStreamer = new SpanStreamer(
    'fake-license-key',
    createFakeConnection(),
    metrics
  )

  spanStreamer.write({})

  t.ok(metricsSpy.firstCall.calledWith(METRIC_NAMES.INFINITE_TRACING.SEEN), 'SEEN metric')

  t.end()
})

tap.test('Should add span to queue on backpressure', (t) => {
  const fakeConnection = createFakeConnection()

  const spanStreamer = new SpanStreamer(
    'fake-license-key',
    fakeConnection,
    createMetricAggregatorForTests(),
    2
  )
  fakeConnection.connectSpans()

  spanStreamer._writable = false
  t.equals(spanStreamer.spans.length, 0, 'no spans queued')
  spanStreamer.write({})

  t.equals(spanStreamer.spans.length, 1, 'one span queued')

  t.end()
})

tap.test('Should drain span queue on stream drain event', (t) => {
  const fakeConnection = createFakeConnection()
  const metrics = createMetricAggregatorForTests()

  /* use PassThrough stream for drain emit */
  const { PassThrough } = require('stream')
  const fakeStream = new PassThrough()

  /* simulate backpressure */
  fakeStream.write = () => false

  fakeConnection.setStream(fakeStream)

  const spanStreamer = new SpanStreamer(
    'fake-license-key',
    fakeConnection,
    metrics,
    1
  )

  fakeConnection.connectSpans()

  t.equals(spanStreamer.spans.length, 0, 'no spans queued')
  const fakeSpan = {
    toStreamingFormat: () => {}
  }

  spanStreamer.write(fakeSpan)
  spanStreamer.write(fakeSpan)

  t.equals(spanStreamer.spans.length, 1, 'one span queued')

  /* emit drain event and allow writes */
  fakeStream.emit('drain', fakeStream.write = () => true)

  t.equals(spanStreamer.spans.length, 0, 'drained spans')
  t.equals(
    metrics.getOrCreateMetric
    (METRIC_NAMES.INFINITE_TRACING.DRAIN_DURATION).callCount, 1, 'DRAIN_DURATION metric')

  t.equals(metrics
    .getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.SENT).callCount, 2, 'SENT metric incremented')

  fakeStream.destroy()

  t.end()
})

tap.test('Should properly format spans sent from the queue', (t) => {
  const fakeConnection = createFakeConnection()
  const metrics = createMetricAggregatorForTests()

  /* use PassThrough stream for drain emit */
  const { PassThrough } = require('stream')
  const fakeStream = new PassThrough()

  /* simulate backpressure */
  fakeStream.write = () => false

  fakeConnection.setStream(fakeStream)

  const spanStreamer = new SpanStreamer(
    'fake-license-key',
    fakeConnection,
    metrics,
    1
  )

  fakeConnection.connectSpans()

  t.equals(spanStreamer.spans.length, 0, 'no spans queued')

  const fakeSpan = new SpanStreamerEvent('sandwich', {}, {})
  const fakeSpan_queued = new SpanStreamerEvent('porridge', {}, {})

  spanStreamer.write(fakeSpan)
  spanStreamer.write(fakeSpan_queued)

  t.equals(spanStreamer.spans.length, 1, 'one span queued')

  /* emit drain event, allow writes and check for span.trace_id */
  fakeStream.emit('drain', fakeStream.write = (span) => {
    t.equal(span.trace_id, 'porridge', 'Should have formatted span')

    return true
  })

  t.equals(spanStreamer.spans.length, 0, 'drained spans')
  t.equals(
    metrics.getOrCreateMetric
    (METRIC_NAMES.INFINITE_TRACING.DRAIN_DURATION).callCount, 1, 'DRAIN_DURATION metric')

  t.equals(metrics
    .getOrCreateMetric(METRIC_NAMES.INFINITE_TRACING.SENT).callCount, 2, 'SENT metric incremented')

  fakeStream.destroy()

  t.end()
})
