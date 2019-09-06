'use strict'

const logger = require('../logger').child({component: 'transaction-event-aggregator'})
const EventAggregator = require('../aggregators/event-aggregator')

const NAMES = require('../metrics/names')

class TransactionEventAggregator extends EventAggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.method = opts.method || 'analytic_event_data'
    opts.metricNames = NAMES.EVENTS

    super(opts, collector, metrics)
  }

  toPayload() {
    // TODO: payload splitting?

    const events = this.events

    if (!events.length > 0) {
      logger.debug('No transaction events to send.')
      return
    }

    const metrics = {
      reservoir_size: events.limit,
      events_seen: events.seen
    }

    const eventData = events.toArray()

    return [this.runId, metrics, eventData]
  }
}

module.exports = TransactionEventAggregator
