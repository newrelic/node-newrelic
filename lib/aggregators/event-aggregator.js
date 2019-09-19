'use strict'

const Aggregator = require('./base-aggregator')
const logger = require('../logger').child({component: 'event_aggregator'})
const PriorityQueue = require('../priority-queue')

/**
 * Aggregates events up to a certain limit.
 *
 * @private
 * @class
 */
class EventAggregator extends Aggregator {
  constructor(opts, collector, metricsAggregator) {
    super(opts, collector)
    // EventEmitter inits an _events collection. So we have to avoid collision
    this._items = new PriorityQueue(opts.limit)
    this._metricNames = opts.metricNames
    this._metrics = metricsAggregator
  }

  get seen() {
    return this._items.seen
  }

  get length() {
    return this._items.length
  }

  get overflow() {
    return this._items.overflow()
  }

  get events() {
    return this._items
  }

  _merge() {
    return this.mergeEvents.apply(this, arguments)
  }

  add() {
    this._metrics.getOrCreateMetric(this._metricNames.SEEN).incrementCallCount()

    const didAdd = this.addEvent.apply(this, arguments)

    if (didAdd && (this._items.overflow() === 0)) {
      this._metrics.getOrCreateMetric(this._metricNames.SENT).incrementCallCount()
    } else {
      this._metrics.getOrCreateMetric(this._metricNames.DROPPED).incrementCallCount()
    }

    return didAdd
  }

  _getMergeData() {
    return this._items
  }

  clear() {
    return this.clearEvents.apply(this, arguments)
  }

  /**
   *
   */
  getQueue() {
    return this._items
  }

  /**
   * Fetches all the span events aggregated.
   *
   * @return {array.<Event>} An array of span events from the aggregator.
   */
  getEvents() {
    return this._items.toArray()
  }

  /**
   * Resets the contents of the aggregator and all counters.
   *
   * @return {PriorityQueue} The old collection of aggregated events.
   */
  clearEvents() {
    // ???: might be more efficient to clear here and come up with an efficient way to
    // serialize the events and priorities
    this._items = new PriorityQueue(this._items.limit)
  }

  reconfigure(config) {
    super.reconfigure(config)
    const newSettings = config.getAggregatorConfig(this.method)
    if (newSettings) {
      this.periodMs = newSettings.periodMs
      this.limit = newSettings.limit
      this._items.setLimit(this.limit)
    } else {
      this.periodMs = this.defaultPeriod
      this.limit = this.defaultLimit
    }
  }

  addEvent(event, priority) {
    return this._items.add(event, priority)
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
    this._items.merge(events)
  }
}

module.exports = EventAggregator
