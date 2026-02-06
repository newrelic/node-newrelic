/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const PropagationSubscriber = require('../propagation')
const { redisClientOpts } = require('../../symbols')

/**
 * Updates `RedisClient[redisClientOpts]` to reflect the new `database_name`
 * as provided by the argument in `RedisClient.SELECT()`.
 *
 * This is required because `RedisClient.#selectedDB` is truly private, or
 * else we'd just read from that.
 */
module.exports = class ClientSelectSubscriber extends PropagationSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: '@redis/client', channelName: 'nr_select' })
  }

  asyncStart(data) {
    const { self: client, arguments: args } = data
    // `client[redisClientOpts]` is defined by client-propagation subscriber
    if (client[redisClientOpts]) {
      // Subsequent commands will be using said database, so update the
      // redisClientOpts on the client (but not the context) (feature parity with v3)
      client[redisClientOpts].database_name = args[0]
    }
    return super.asyncStart(data)
  }
}
