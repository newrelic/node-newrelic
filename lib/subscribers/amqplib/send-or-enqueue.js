/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const PropagationSubscriber = require('../propagation')

/**
 * This subscriber is purely for propagation of async context.
 * It breaks without binding the transaction and segment from the result of the previous handler.
 */
class SendOrEnqueueSubscriber extends PropagationSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'amqplib', channelName: 'nr_sendOrEnqueue', callback: -1 })
  }
}

module.exports = SendOrEnqueueSubscriber
