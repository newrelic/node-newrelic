/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const GetMessageSubscriber = require('./get')

class GetMessageCbSubscriber extends GetMessageSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'amqplib', channelName: 'cb_get' })
    this.events = ['asyncStart', 'asyncEnd']
    this.callback = -1
  }
}

module.exports = GetMessageCbSubscriber
