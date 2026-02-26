/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const ClientPropagationSubscriber = require('./client-propagation')

/**
 * Propagates the context in `RedisClient.MULTI` / `RedisClient.multi` and
 * `RedisClient[redisClientOpts]` into `RedisCommandQueue.addCommand`.
 */
module.exports = class ClientMultiSubscriber extends ClientPropagationSubscriber {
  constructor({ agent, logger, packageName = '@redis/client' }) {
    super({ agent, logger, packageName, channelName: 'nr_multi' })
  }
}
