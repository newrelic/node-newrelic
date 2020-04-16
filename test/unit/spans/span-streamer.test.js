'use strict'
const tap = require('tap')
const SpanStreamer = require('../../../lib/spans/span-streamer')
const GrpcConnection = require('../../../lib/grpc/connection')
const MetricAggregator = require('../../../lib/metrics/metric-aggregator')
const MetricMapper = require('../../../lib/metrics/mapper')
const MetricNormalizer = require('../../../lib/metrics/normalizer')
const EventEmitter = require('events').EventEmitter
const NAMES = require('../../../lib/metrics/names')

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
  setConnectionDetails() {
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

tap.test('write(span) should return false with no stream set', (t) => {
  const fakeConnection = createFakeConnection()
  const spanStreamer = new SpanStreamer('fake-license-key', fakeConnection)

  t.notOk(spanStreamer.write({}))

  t.end()
})

tap.test('write(span) should return false when not writeable', (t) => {
  const fakeConnection = createFakeConnection()
  fakeConnection.connectSpans = () => {}

  const spanStreamer = new SpanStreamer('fake-license-key', fakeConnection)
  spanStreamer._writable = false

  t.notOk(spanStreamer.write({}))

  t.end()
})

tap.test('write(span) should return true when able to write to stream', (t) => {
  const fakeStream = {
    write: () => true
  }

  const fakeConnection = createFakeConnection()
  fakeConnection.connectSpans = () => {
    fakeConnection.emit('connected', fakeStream)
  }

  const fakeSpan = {
    toStreamingFormat: () => {}
  }

  const spanStreamer = new SpanStreamer('fake-license-key', fakeConnection)
  spanStreamer.connect(1)

  t.ok(spanStreamer.write(fakeSpan))

  t.end()
})

tap.test('write(span) should return true with backpressure', (t) => {
  const fakeStream = {
    write: () => false,
    once: () => {}
  }
  const fakeConnection = createFakeConnection()
  fakeConnection.connectSpans = () => {
    fakeConnection.emit('connected', fakeStream)
  }
  const fakeSpan = {
    toStreamingFormat: () => {}
  }

  const spanStreamer = new SpanStreamer('fake-license-key', fakeConnection)
  spanStreamer.connect(1)

  t.ok(spanStreamer.write(fakeSpan))

  t.end()
})

tap.test('write(span) should return false when stream.write throws error', (t) => {
  const fakeStream = {
    write: () => {
      throw new Error('whoa!')
    },
    once: () => {}
  }
  const fakeConnection = createFakeConnection()
  fakeConnection.connectSpans = () => {
    fakeConnection.emit('connected', fakeStream)
  }
  const fakeSpan = {
    toStreamingFormat: () => {}
  }
  const metrics = createMetricAggregatorForTests()

  const spanStreamer = new SpanStreamer('fake-license-key', fakeConnection, metrics)
  spanStreamer.connect(1)

  t.notOk(spanStreamer.write(fakeSpan))

  const metric = metrics.getOrCreateMetric(NAMES.INFINITE_TRACING.SPAN_RESPONSE_ERROR)

  t.equal(metric.callCount, 1, 'incremented SPAN_RESPONSE_ERROR metric')

  t.end()
})
