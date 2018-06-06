'use strict'

const logger = require('./logger').child({component: 'event_aggregator'})
const PriorityQueue = require('./priority-queue')

/**
 * Aggregates events up to a certain limit.
 *
 * @private
 * @class
 */
class EventAggregator {
  constructor(limit) {
    this._events = new PriorityQueue(limit)
  }

  get limit() {
    return this._events.limit
  }

  set limit(limit) {
    this._events.setLimit(limit)
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
    const oldEvents = this._events
    this._events = new PriorityQueue(this._events.limit)
    return oldEvents
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

    this._events.merge(events)
  }
}

module.exports = EventAggregator
