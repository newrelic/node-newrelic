/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const PropagationSubscriber = require('./client-propagation')
const { redisClientOpts } = require('../../symbols')

module.exports = class LegacySendCommandSubscriber extends PropagationSubscriber {
  constructor({ agent, logger, packageName = '@redis/client' }) {
    super({ agent, logger, packageName, channelName: 'nr_legacySendCommand' })
    this.events = ['start']
  }

  start(data) {
    // start always fires (with or without context)
    // Initialize client options here so they're available for
    // both in-transaction and out-of-transaction commands
    const { self: client, arguments: args } = data
    if (!client[redisClientOpts]) {
      client[redisClientOpts] = this.getRedisParams(client.options)
    }
    let params
    if (Array.isArray(args[0])) {
      params = args[0]
    } else {
      params = args
    }
    if (params[0] === 'select') {
      // Store the database name for future commands
      client[redisClientOpts].database_name = params[1]
    }
    return data
  }
}
