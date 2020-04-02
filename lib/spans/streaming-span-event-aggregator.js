'use strict'

const Aggregator = require('../aggregators/base-aggregator')
const StreamingSpanEvent = require('./streaming-span-event')
const NAMES = require('../metrics/names')
const logger = require('../logger').child({component: 'streaming-span-event-aggregator'})

const SEND_WARNING =
  'send() is not currently supported on streaming span event aggregator. ' +
  'This warning will not appear again this agent run.'

class StreamingSpanEventAggregator extends Aggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.periodMs = opts.periodMs ? opts.periodMs : 1000
    opts.limit = opts.limit ? opts.limit : 10000
    opts.method = opts.method || 'span_event_data'
    
    super(opts, collector)
    
    this.metricNames = opts.metricNames || NAMES.STREAMING_SPAN_EVENTS
    this.stream = opts.span_streamer
    this.metrics = metrics
    this.started = false
  }

  start() {
    logger.trace('StreamingSpanEventAggregator starting up')
    this.stream.connect(this.runId)
    this.started = true
  }

  stop() {
    this.stream.disconnect()
    this.started = false
  }

  send() {
    // Only log once started. This will get invoked on initial harvest
    // prior to start which we'll just ignore.
    if (this.started) {
      logger.warnOnce(SEND_WARNING)
    }

    this.emit(`finished ${this.method} data send.`)

    return
  }

  /**
   * Not a payload based aggregator
   *
   * This is here to implement the implicit interface
   */
  _toPayloadSync() {
    return
  }

  /**
   * Attempts to add the given segment to the collection.
   *
   * @param {TraceSegment}  segment         - The segment to add.
   * @param {string}        [parentId=null] - The GUID of the parent span.
   *
   * @return {bool} True if the segment was added, or false if it was discarded.
   */
  addSegment(segment, parentId, isRoot) {
    this.metrics.getOrCreateMetric(this.metricNames.SEEN).incrementCallCount()
    
    if (!this.started) {
      logger.trace('Aggregator has not yet started, dropping span (%s).', segment.name)
      return
    }

    const span = StreamingSpanEvent.fromSegment(segment, parentId, isRoot)

    if (this.stream.write(span)) {
      this.metrics.getOrCreateMetric(this.metricNames.SENT).incrementCallCount()
    }
  }
}

module.exports = StreamingSpanEventAggregator
