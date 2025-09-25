/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const PurgeQueueSubscriber = require('./purge-queue')

class PurgeQueueCbSubscriber extends PurgeQueueSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'cb_purgeQueue' })
    this.events = ['asyncStart', 'asyncEnd']
    this.callback = -1
  }
}

module.exports = PurgeQueueCbSubscriber
