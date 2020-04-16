'use strict'

const tap = require('tap')
const sinon = require('sinon')

const StreamingSpanEventAggregator = require('../../../lib/spans/streaming-span-event-aggregator')
const METRIC_NAMES = require('../../../lib/metrics/names')
const Metrics = require('../../../lib/metrics')
const StreamingSpanEvent = require('../../../lib/spans/streaming-span-event')


tap.test('Should increment SEEN and SENT metrics on successful write', (t) => {
  const stub = sinon.stub(StreamingSpanEvent, 'fromSegment').callsFake(() => {})
  t.teardown(() => {
    stub.restore()
  })

  const MockedStream = {
    write: () => true,
    connect: () => {}
  }

  const opts = {
    span_streamer: MockedStream
  }

  const metrics = new Metrics(5, {}, {})
  const metricsSpy = sinon.spy(metrics, 'getOrCreateMetric')

  const aggregator = new StreamingSpanEventAggregator(opts, () => {}, metrics)

  aggregator.start()
  aggregator.addSegment({}, 'fake', true)

  t.equal(metricsSpy.callCount, 2, 'should have incremented two metrics')
  t.ok(metricsSpy.firstCall.calledWith(METRIC_NAMES.INFINITE_TRACING.SEEN), 'SEEN metric')
  t.ok(metricsSpy.secondCall.calledWith(METRIC_NAMES.INFINITE_TRACING.SENT), 'SENT metric')

  t.end()
})

tap.test('Should increment SEEN metric and not SENT metric if stream.write fails', (t) => {
  const stub = sinon.stub(StreamingSpanEvent, 'fromSegment').callsFake(() => {})
  t.teardown(() => {
    stub.restore()
  })

  const MockedStream = {
    write: () => false,
    connect: () => {}
  }

  const opts = {
    span_streamer: MockedStream
  }

  const metrics = new Metrics(5, {}, {})
  const metricsSpy = sinon.spy(metrics, 'getOrCreateMetric')

  const aggregator = new StreamingSpanEventAggregator(opts, () => {}, metrics)

  aggregator.start()
  aggregator.addSegment({}, 'fake', true)

  t.equal(metricsSpy.callCount, 1, 'should have incremented only one metrics')
  t.ok(metricsSpy.firstCall.calledWith(METRIC_NAMES.INFINITE_TRACING.SEEN), 'SEEN metric')

  t.end()
})

tap.test('Should not increment SEEN or SENT metrics if aggregator not started', (t) => {
  const MockedStream = {
    write: () => true,
    connect: () => {}
  }

  const opts = {
    span_streamer: MockedStream
  }

  const metrics = new Metrics(5, {}, {})
  const metricsSpy = sinon.spy(metrics, 'getOrCreateMetric')

  const aggregator = new StreamingSpanEventAggregator(opts, () => {}, metrics)

  aggregator.addSegment({}, 'fake', true)

  t.equal(metricsSpy.callCount, 0)

  t.end()
})

tap.test('Should only attempt to connect on first start() call', (t) => {
  let connectCount = 0

  const opts = {
    span_streamer: {
      connect: () => { connectCount++ }
    }
  }

  const streamingSpanAggregator = new StreamingSpanEventAggregator(opts)

  streamingSpanAggregator.start()
  t.equal(connectCount, 1)

  streamingSpanAggregator.start()
  t.equal(connectCount, 1)

  t.end()
})

tap.test('Should only attempt to disconnect on first stop() call', (t) => {
  let disonnectCount = 0

  const opts = {
    span_streamer: {
      connect: () => {},
      disconnect: () => { disonnectCount++ }
    }
  }

  const streamingSpanAggregator = new StreamingSpanEventAggregator(opts)
  streamingSpanAggregator.start()

  streamingSpanAggregator.stop()
  t.equal(disonnectCount, 1)

  streamingSpanAggregator.stop()
  t.equal(disonnectCount, 1)

  t.end()
})

tap.test('Should attempt to connect on start() after stop() call', (t) => {
  let connectCount = 0

  const opts = {
    span_streamer: {
      connect: () => { connectCount++ },
      disconnect: () => {}
    }
  }

  const streamingSpanAggregator = new StreamingSpanEventAggregator(opts)

  streamingSpanAggregator.start()
  streamingSpanAggregator.stop()

  streamingSpanAggregator.start()
  t.equal(connectCount, 2)

  t.end()
})
