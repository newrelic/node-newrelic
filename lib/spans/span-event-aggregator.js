'use strict'

const logger = require('../logger')
let spanLogger = null
const EventAggregator = require('../aggregators/event-aggregator')
const SpanEvent = require('./span-event')
const NAMES = require('../metrics/names')
const LIMIT = 1000

class SpanEventAggregator extends EventAggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.method = opts.method || 'span_event_data'
    opts.metricNames = opts.metricNames || NAMES.SPAN_EVENTS

    spanLogger = logger.child({component: 'span_aggregator'})

    super(opts, collector, metrics)
  }

  _toPayloadSync() {
    const events = this.events

    if (events.length === 0) {
      spanLogger.debug('No span events to send.')
      return
    }

    const metrics = {
      reservoir_size: events.limit,
      events_seen: events.seen
    }
    const eventData = events.toArray()

    return [this.runId, metrics, eventData]
  }

  send() {
    if (spanLogger.traceEnabled()) {
      spanLogger.trace({
        spansCollected: this.length,
        spansSeen: this.seen
      }, 'Entity stats on span harvest')
    }
    super.send()
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
      this._metrics.getOrCreateMetric(this._metricNames.SEEN).incrementCallCount()

      return false
    }
    const span = SpanEvent.fromSegment(segment, parentId || null)
    return this.add(span, tx.priority)
  }
}

module.exports = SpanEventAggregator
module.exports.LIMIT = LIMIT
