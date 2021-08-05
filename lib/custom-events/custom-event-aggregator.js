/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'custom-event-aggregator' })
const EventAggregator = require('../aggregators/event-aggregator')

const NAMES = require('../metrics/names')

class CustomEventAggregator extends EventAggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.method = opts.method || 'custom_event_data'
    opts.metricNames = NAMES.CUSTOM_EVENTS

    super(opts, collector, metrics)
  }

  _toPayloadSync() {
    const events = this.events

    if (events.length === 0) {
      logger.debug('No custom events to send.')
      return
    }

    const eventData = events.toArray()

    return [this.runId, eventData]
  }
}

module.exports = CustomEventAggregator
