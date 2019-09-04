'use strict'

const logger = require('../logger').child({component: 'span_aggregator'})
const EventAggregator = require('../aggregators/event-aggregator')
const SpanEvent = require('./span-event')
const NAMES = require('../metrics/names')

class SpanEventAggregator extends EventAggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.method = opts.method || 'span_event_data'
    opts.metricNames = NAMES.SPAN_EVENTS

    super(opts, collector, metrics)
  }

  toPayload() {
    const events = this.events

    if (!events.length > 0) {
      logger.debug('No span events to send.')
      return
    }

    const metrics = {
      reservoir_size: events.limit,
      events_seen: events.seen
    }

    const eventData = events.toArray()

    return [this.runId, metrics, eventData]
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
    if (tx.priority < this._items.getMinimumPriority()) {
      ++this.events.seen
      return false
    }
    const span = SpanEvent.fromSegment(segment, parentId || null)
    return this.addEvent(span, tx.priority)
  }
}

module.exports = SpanEventAggregator
