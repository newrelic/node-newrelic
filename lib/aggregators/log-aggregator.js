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
  constructor(opts, collector, metrics, agent) {
    opts = opts || {}
    opts.method = opts.method || 'log_event_data'
    opts.metricNames = NAMES.LOGGING

    super(opts, collector, metrics)
    this.agent = agent
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

  add(logLine) {
    logLine = typeof logLine === 'string' ? JSON.parse(logLine) : logLine
    const transaction = this.agent.getTransaction()
    if (transaction) {
      transaction.logs.add(logLine)
    } else {
      super.add(logLine)
    }
  }

  addBatch(logs, priority) {
    logs.forEach((logLine) => {
      super.add(logLine, priority)
    })
  }
}

module.exports = LogAggregator
