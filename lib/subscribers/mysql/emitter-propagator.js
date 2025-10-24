/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const PropagationSubscriber = require('../propagation')
const { EventEmitter } = require('node:events')

/**
 * Provides a base `PropagationSubscriber` for MySQL functions that
 * need their context propagated and the first argument of the
 * function call wrapped as an `EventEmitter`.
 *
 * Defaults to listening to `mysql` `nr_protocolEnqueue` channel.
 */
class MySQLEmitterPropagator extends PropagationSubscriber {
  constructor({ agent, logger, packageName = 'mysql', channelName = 'nr_protocolEnqueue' }) {
    super({ agent, logger, packageName, channelName, callback: -1 })
  }

  /**
   * If the first argument in the original function call
   * is an `EventEmitter`, we wrap the stream events,
   * so we can propagate the context correctly.
   * @param {object} data event data
   * @param {object} ctx current context
   */
  handler(data, ctx) {
    if (data?.arguments[0] instanceof EventEmitter) {
      this.wrapEventEmitter({ args: data.arguments, index: 0, ctx })
    }
    return ctx
  }
}

module.exports = MySQLEmitterPropagator
