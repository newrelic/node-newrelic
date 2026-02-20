/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const ClientPropagationSubscriber = require('./client-propagation')

/**
 * Listens to events on RedisClient.commandsExectutor for redis versions <=5.
 * Replacement for send-command.js for that version.
 */
module.exports = class ClientCommandsExecutorSubscriber extends ClientPropagationSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_commandsExecutor' })
  }
}
