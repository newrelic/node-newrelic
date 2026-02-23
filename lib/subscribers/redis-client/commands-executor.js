/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const ClientPropagationSubscriber = require('./client-propagation')

/**
 * Listens to events on `RedisClient.commandsExecutor` to propagate context
 * for `addCommand` for redis versions <=5.
 */
module.exports = class ClientCommandsExecutorSubscriber extends ClientPropagationSubscriber {
  constructor({ agent, logger, packageName = '@redis/client' }) {
    super({ agent, logger, packageName, channelName: 'nr_commandsExecutor' })
  }
}
