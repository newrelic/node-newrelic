/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const PropagationSubscriber = require('../propagation')
const { EventEmitter } = require('node:events')

/**
 * This subscriber is required to wrap the `Query` (`EventEmitter`)
 * stream events.
 */
class ProtocolEnqueueSubscriber extends PropagationSubscriber {
  constructor({ agent, logger, packageName = 'mysql', channelName = 'nr_protocolEnqueue' }) {
    super({ agent, logger, packageName, channelName, callback: -1 })
  }

  handler(data, ctx) {
    const newCtx = super.handler(data, ctx)
    if (data?.arguments[0] instanceof EventEmitter) {
      this.wrapEventEmitter({ args: data.arguments, index: 0, name: 'emit', ctx: newCtx })
    }
    return newCtx
  }
}

module.exports = ProtocolEnqueueSubscriber
