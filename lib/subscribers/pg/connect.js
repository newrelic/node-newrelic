/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Subscriber = require('../base.js')

/**
 * Subscribes to the `connect` event for PostgreSQL's (`pg`) `Client` class.
 */
class PgConnectSubscriber extends Subscriber {
  constructor({ agent, logger, channelName = 'nr_connect', packageName = 'pg' }) {
    super({ agent, logger, channelName, packageName })
    this.events = ['asyncEnd']
    this.callback = -1
  }

  handler(data, ctx) {
    return this.createSegment({
      name: 'connect',
      ctx
    })
  }
}

module.exports = PgConnectSubscriber
