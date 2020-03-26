'use strict'

const EventAggregator = require('../aggregators/event-aggregator')
const StreamingSpanEvent = require('./streaming-span-event')
const NAMES = require('../metrics/names')
const logger = require('../logger').child({component: 'streaming-span-event-aggregator'})

const SEND_WARNING =
  'send() is not currently supported on streaming span event aggregator. ' +
  'This warning will not appear again this agent run.'

class StreamingSpanEventAggregator extends EventAggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.metricNames = opts.metricNames || NAMES.SPAN_EVENTS
    opts.periodMs = opts.periodMs ? opts.periodMs : 1000
    opts.limit = opts.limit ? opts.limit : 10000
    opts.method = opts.method || 'span_event_data'
    super(opts, collector, metrics)
    this.stream = opts.span_streamer
    this.started = false
  }

  start() {
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

    const span = StreamingSpanEvent.fromSegment(segment, parentId, isRoot)
    this.sendSpan(span)
  }

  sendSpan(span) {
    try {
      const formattedSpan = span.toStreamingFormat()

      const canKeepWriting = this.stream.write(formattedSpan)
      this.spansSent++

      if (!canKeepWriting) {
        // TODO: handle backpressure
        // Not supposed to write anymore. Can resume after drain completion/event.
      }
    } catch (err) {
      logger.trace('Could not stream span.', err)
      // TODO: something has gone horribly wrong.
      // We may want to log and turn off this aggregator
      // to prevent sending further spans. Maybe even "disable" their creation?
      // or is there a situation where we can recover?
    }
  }
}

module.exports = StreamingSpanEventAggregator
