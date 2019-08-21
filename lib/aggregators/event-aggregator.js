'use strict'

const Aggregator = require('./base-aggregator')
const logger = require('../logger').child({component: 'event_aggregator'})
const PriorityQueue = require('../priority-queue')

// TODO: remove old event aggregator
// and cleanup unused methods

/**
 * Aggregates events up to a certain limit.
 *
 * @private
 * @class
 */
class EventAggregator extends Aggregator {
  constructor(opts, collector, metricsAggregator) {
    super(opts, collector)
    this._events = new PriorityQueue(opts.limit)
    this._metricNames = opts.metricNames
    this._metrics = metricsAggregator
  }

  get seen() {
    return this._events.seen
  }

  get length() {
    return this._events.length
  }

  get overflow() {
    return this._events.overflow()
  }

  get events() {
    return this._events
  }

  merge() {
    return this.mergeEvents.apply(this, arguments)
  }

  add() {
    this._metrics.getOrCreateMetric(this._metricNames.SEEN).incrementCallCount()

    const didAdd = this.addEvent.apply(this, arguments)

    if (didAdd && (this._events.overflow() === 0)) {
      this._metrics.getOrCreateMetric(this._metricNames.SENT).incrementCallCount()
    } else {
      this._metrics.getOrCreateMetric(this._metricNames.DROPPED).incrementCallCount()
    }

    return didAdd
  }

  getData() {
    return this._events
  }

  clear() {
    return this.clearEvents.apply(this, arguments)
  }

  /**
   *
   */
  getQueue() {
    return this._events
  }

  /**
   * Fetches all the span events aggregated.
   *
   * @return {array.<Event>} An array of span events from the aggregator.
   */
  getEvents() {
    return this._events.toArray()
  }

  /**
   * Resets the contents of the aggregator and all counters.
   *
   * @return {PriorityQueue} The old collection of aggregated events.
   */
  clearEvents() {
    // ???: might be more efficient to clear here and come up with an efficient way to
    // serialize the events and priorities
    this._events = new PriorityQueue(this._events.limit)
  }

  addEvent(event, priority) {
    return this._events.add(event, priority)
  }

  /**
   * Merges a set of events back into the aggregator.
   *
   * This should only be used after a failed harvest with the `PriorityQueue`
   * returned from `EventAggregator#clearEvents`.
   *
   * @param {?PriorityQueue} events - The collection of events to re-merge.
   */
  mergeEvents(events) {
    if (!events) {
      return
    }

    // We calculate the number that will be merged for the log, but we try to
    // add every event because we want the ones with the highest priority, not
    // the first `n` events.
    const toMerge = Math.min(events.length, this.limit - this.length)
    logger.warn(
      'Merging %d of %d events into %s for next harvest',
      toMerge, events.length, this.constructor.name
    )

    const seen = events.length
    const sent = toMerge
    const dropped = seen - sent

    this._metrics.getOrCreateMetric(this._metricNames.SEEN).incrementCallCount(seen)
    this._metrics.getOrCreateMetric(this._metricNames.SENT).incrementCallCount(sent)

    if (dropped > 0) {
      this._metrics
        .getOrCreateMetric(this._metricNames.DROPPED)
        .incrementCallCount(dropped)
    }

    // merge modifies incoming events collection.
    this._events.merge(events)
  }
}

module.exports = EventAggregator
