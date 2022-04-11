/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'logs_aggregator' })
const EventAggregator = require('./event-aggregator')

const NAMES = require('../metrics/names')

/**
 * Aggregates log events up to a certain limit.
 *
 * @private
 * @class
 */
class LogAggregator extends EventAggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.method = opts.method || 'log_event_data'
    opts.metricNames = NAMES.LOGGING

    super(opts, collector, metrics)
  }

  _toPayloadSync() {
    const events = this.events

    if (events.length === 0) {
      logger.debug('No log events to send.')
      return
    }

    const eventData = events.toArray()
    return [{ logs: eventData }]
  }
}

module.exports = LogAggregator
