'use strict'

const tap = require('tap')
const sinon = require('sinon')

const StreamingSpanEventAggregator = require('../../../lib/spans/streaming-span-event-aggregator')
const METRIC_NAMES = require('../../../lib/metrics/names')
const Metrics = require('../../../lib/metrics')
const streamingSpanEvent = require('../../../lib/spans/streaming-span-event')

sinon.stub(streamingSpanEvent, 'fromSegment').callsFake(() => {})

tap.test('Should increment SEEN and SENT metrics on successful write', (t) => {
  const MockedStream = require('stream').Writable

  MockedStream.write = () => true
  MockedStream.connect = () => {}

  const opts = {
    span_streamer: MockedStream
  }
  
  sinon.mock(streamingSpanEvent)
  const metrics = new Metrics(5, {}, {})
  const metricsSpy = sinon.spy(metrics, 'getOrCreateMetric')

  const aggregator = new StreamingSpanEventAggregator(opts, () => {}, metrics)

  aggregator.start()
  aggregator.addSegment({}, 'fake', true)

  t.equal(metricsSpy.callCount, 2, 'should have incremented two metrics')
  t.ok(metricsSpy.firstCall.calledWith(METRIC_NAMES.STREAMING_SPAN_EVENTS.SEEN), 'SEEN metric')
  t.ok(metricsSpy.secondCall.calledWith(METRIC_NAMES.STREAMING_SPAN_EVENTS.SENT), 'SENT metric')

  t.end()
})

tap.test('Should increment SEEN metric and not SEND metric if stream.write fails', (t) => {
  const MockedStream = require('stream').Writable

  MockedStream.write = () => false
  MockedStream.connect = () => {}

  const opts = {
    span_streamer: MockedStream
  }
  
  sinon.mock(streamingSpanEvent)
  const metrics = new Metrics(5, {}, {})
  const metricsSpy = sinon.spy(metrics, 'getOrCreateMetric')

  const aggregator = new StreamingSpanEventAggregator(opts, () => {}, metrics)

  aggregator.start()
  aggregator.addSegment({}, 'fake', true)

  t.equal(metricsSpy.callCount, 1, 'should have incremented only one metrics')
  t.ok(metricsSpy.firstCall.calledWith(METRIC_NAMES.STREAMING_SPAN_EVENTS.SEEN), 'SEEN metric')

  t.end()
})

tap.test('Should increment SEEN metric and not SEND metric if aggregator not started', (t) => {
  const opts = {
    span_streamer: () => {}
  }

  sinon.mock(streamingSpanEvent)
  const metrics = new Metrics(5, {}, {})
  const metricsSpy = sinon.spy(metrics, 'getOrCreateMetric')

  const aggregator = new StreamingSpanEventAggregator(opts, () => {}, metrics)

  aggregator.addSegment({}, 'fake', true)

  t.equal(metricsSpy.callCount, 1, 'should have incremented only one metrics')
  t.ok(metricsSpy.firstCall.calledWith(METRIC_NAMES.STREAMING_SPAN_EVENTS.SEEN), 'SEEN metric')

  t.end()
})
