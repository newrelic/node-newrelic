/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'error_tracer' })
const EventAggregator = require('../aggregators/event-aggregator')

const NAMES = require('../metrics/names')

class ErrorEventAggregator extends EventAggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.method = opts.method || 'error_event_data'
    opts.metricNames = NAMES.TRANSACTION_ERROR

    super(opts, collector, metrics)
  }

  _toPayloadSync() {
    const events = this.events

    if (events.length === 0) {
      logger.debug('No error events to send.')
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

module.exports = ErrorEventAggregator
