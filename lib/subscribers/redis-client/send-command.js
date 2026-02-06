/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const ClientPropagationSubscriber = require('./client-propagation')

/**
 * Propagates the context in `RedisClient.sendCommand` and
 * `RedisClient[redisClientOpts]` into `RedisCommandQueue.addCommand`.
 */
module.exports = class ClientSendCommandSubscriber extends ClientPropagationSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_sendCommand' })
  }
}
