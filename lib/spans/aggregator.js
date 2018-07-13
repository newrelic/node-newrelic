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
   * @param {TraceSegment}  segment         - The segment to add.
   * @param {string}        [parentId=null] - The GUID of the parent span.
   *
   * @return {bool} True if the segment was added, or false if it was discarded.
   */
  addSegment(segment, parentId) {
    // Check if the priority would be accepted before creating the event object.
    const tx = segment.transaction
    if (tx.priority < this._events.getMinimumPriority()) {
      ++this._events.seen
      return false
    }
    const span = SpanEvent.fromSegment(segment, parentId || null)
    return this.addEvent(span, tx.priority)
  }
}

module.exports = SpanAggregator
