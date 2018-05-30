'use strict'

const EventAggregator = require('../event-aggregator')
const SpanEvent = require('./span-event')

const SPAN_EVENT_LIMIT = 1000

/**
 * Aggregates span events up to a certain limit.
 *
 * @private
 * @class
 */
class SpanAggregator extends EventAggregator {
  constructor() {
    super(SPAN_EVENT_LIMIT)
  }

  /**
   * Attempts to add the given segment to the collection.
   *
   * @param {TraceSegment} segment - The segment to add.
   *
   * @return {bool} True if the segment was added, or false if it was discarded.
   */
  addSegment(segment, parentId = null, grandparentId = null) {
    // Check if the priority would be accepted before creating the event object.
    if (segment.getPriority() < this._events.getMinimumPriority()) {
      ++this._events.seen
      return false
    }
    const span = SpanEvent.fromSegment(segment, parentId, grandparentId)
    return this.addEvent(span, segment.getPriority())
  }
}

module.exports = SpanAggregator
