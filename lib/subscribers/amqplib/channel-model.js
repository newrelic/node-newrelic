/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MetaSubscriber = require('../meta-subscriber')
const CHANNEL_METHODS = [
  'nr_close',
  'nr_open',
  'nr_assertQueue',
  'nr_checkQueue',
  'nr_deleteQueue',
  'nr_bindQueue',
  'nr_unbindQueue',
  'nr_assertExchange',
  'nr_checkExchange',
  'nr_deleteExchange',
  'nr_bindExchange',
  'nr_unbindExchange',
  'nr_cancel',
  'nr_prefetch',
  'nr_recover'
]

class ChannelModelSubscriber extends MetaSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'amqplib', channelName: 'channelModel', channels: CHANNEL_METHODS, events: ['asyncEnd'] })
  }

  handler(data, ctx) {
    const [, name] = this.channelName.split('_')
    return this.createSegment({
      name: `Channel#${name}`,
      ctx
    })
  }
}

module.exports = ChannelModelSubscriber
