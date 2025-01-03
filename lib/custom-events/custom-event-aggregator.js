/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'custom-event-aggregator' })
const EventAggregator = require('../aggregators/event-aggregator')

class CustomEventAggregator extends EventAggregator {
  constructor(opts, agent) {
    opts = opts || {}
    opts.method = opts.method || 'custom_event_data'

    super(opts, agent)
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
