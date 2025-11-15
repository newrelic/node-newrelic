/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MetaSubscriber = require('../meta-subscriber')
const CHANNEL_METHODS = [
  'cb_close',
  'cb_open',
  'cb_assertQueue',
  'cb_checkQueue',
  'cb_deleteQueue',
  'cb_bindQueue',
  'nr_unbindQueue',
  'cb_assertExchange',
  'cb_checkExchange',
  'cb_deleteExchange',
  'cb_bindExchange',
  'cb_unbindExchange',
  'cb_cancel',
  'cb_prefetch',
  'cb_recover'
]

class ChannelModelSubscriber extends MetaSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'amqplib', channelName: 'channelModel', channels: CHANNEL_METHODS, events: ['asyncEnd'], callback: -1 })
  }

  handler(_data, ctx) {
    const [, name] = this.channelName.split('_')
    return this.createSegment({
      name: `Channel#${name}`,
      ctx
    })
  }
}

module.exports = ChannelModelSubscriber
