/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const ClientPropagationSubscriber = require('./client-propagation')
const { redisClientOpts } = require('../../symbols')

/**
 * Propagates the context in `RedisClient.MULTI` / `RedisClient.multi` and
 * `RedisClient[redisClientOpts]` into `RedisCommandQueue.addCommand`.
 */
module.exports = class ClientMultiSubscriber extends ClientPropagationSubscriber {
  constructor({ agent, logger, packageName = '@redis/client' }) {
    super({ agent, logger, packageName, channelName: 'nr_multi' })
    this.events = ['start']
  }

  start(data) {
    const { self: client } = data
    if (!client[redisClientOpts]) {
      client[redisClientOpts] = this.getRedisParams(client.options)
    }
  }
}
