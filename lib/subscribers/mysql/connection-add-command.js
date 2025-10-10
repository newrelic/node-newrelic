/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const PropagationSubscriber = require('../propagation')
const { EventEmitter } = require('node:events')

class MySQL2ConnectionAddCommandSubscriber extends PropagationSubscriber {
  constructor({ agent, logger, channelName = 'nr_connectionAddCommand', packageName = 'mysql2' }) {
    super({ agent, logger, packageName, channelName, callback: null })
  }

  handler(data, ctx) {
    const newCtx = super.handler(data, ctx)
    const queryEE = data?.arguments?.[0]
    if (queryEE && queryEE instanceof EventEmitter) {
      this.wrapEventEmitter({ args: data.arguments, index: 0, name: 'emit', ctx: newCtx })
    }
    return newCtx
  }
}

module.exports = MySQL2ConnectionAddCommandSubscriber
