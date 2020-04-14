'use strict'

const Aggregator = require('../aggregators/base-aggregator')
const StreamingSpanEvent = require('./streaming-span-event')
const NAMES = require('../metrics/names')
const logger = require('../logger').child({component: 'streaming-span-event-aggregator'})

const SEND_WARNING =
  'send() is not currently supported on streaming span event aggregator. ' +
  'This warning will not appear again this agent run.'

// TODO: this doesn't "aggregate". Perhaps we need a different terminology
// for the base-class and then this implementation can avoid the misleading language.
class StreamingSpanEventAggregator extends Aggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.periodMs = opts.periodMs ? opts.periodMs : 1000
    opts.limit = opts.limit ? opts.limit : 10000
    opts.method = opts.method || 'span_event_data'

    super(opts, collector)

    this.metricNames = opts.metricNames || NAMES.INFINITE_TRACING
    this.stream = opts.span_streamer
    this.metrics = metrics
    this.started = false
    this.isStream = true
  }

  start() {
    if (this.started) {
      return
    }

    logger.trace('StreamingSpanEventAggregator starting up')
    this.stream.connect(this.runId)
    this.started = true
  }

  stop() {
    if (!this.started) {
      return
    }

    logger.trace('StreamingSpanEventAggregator stopping')
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
    if (!this.started) {
      logger.trace('Aggregator has not yet started, dropping span (%s).', segment.name)
      return
    }

    // SEEN/SENT are to understand where we've had to drop spans due back-pressure, errors,
    // reconnects, etc. so moving after start check to avoid logging for a
    // currently unsupported case.
    this.metrics.getOrCreateMetric(this.metricNames.SEEN).incrementCallCount()

    const span = StreamingSpanEvent.fromSegment(segment, parentId, isRoot)

    if (this.stream.write(span)) {
      this.metrics.getOrCreateMetric(this.metricNames.SENT).incrementCallCount()
    }
  }
}

module.exports = StreamingSpanEventAggregator
