'use strict'

const EventAggregator = require('../aggregators/event-aggregator')
const StreamingSpanEvent = require('./streaming-span-event')
const NAMES = require('../metrics/names')

class StreamingSpanEventAggregator extends EventAggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.metricNames = opts.metricNames || NAMES.SPAN_EVENTS
    opts.periodMs = opts.periodMs ? opts.periodMs : 1000
    opts.limit = opts.limit ? opts.limit : 10000
    opts.method = opts.method || 'span_event_data'
    super(opts, collector, metrics)
    this.stream = opts.span_streamer
  }

  start() {
    this.stream.connect(this.runId)
  }

  stop() {
    this.stream.disconnect()
  }

  send() {
    // START: old proirity queue based span sending
    //        this is left over code from our earliest
    //        prototype where we used normal aggregation, but
    //        with a one second timeout
    for (const [, span] of this._items.toArray().entries()) {
      const result = this.stream.write(span)
      if (!result) {
        // console.log('this.stream.write returned false, what do i do? Back preasure.')
      }
      this.spansSent++
    }
    // END: old proirity queue based span sending

    // TODO/APPOLOGIES: do we ever need to end the stream?
    // stream.end()
    super.send()
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
    const span = StreamingSpanEvent.fromSegment(segment, parentId, isRoot)
    this.sendSpan(span)
  }

  sendSpan(span) {
    const formattedSpan = span.toStreamingFormat()

    const canKeepWriting = this.stream.write(formattedSpan)
    this.spansSent++

    if (!canKeepWriting) {
      // TODO: handle backpressure
      // Not supposed to write anymore. Can resume after drain completion/event.
    }
  }
}

module.exports = StreamingSpanEventAggregator
