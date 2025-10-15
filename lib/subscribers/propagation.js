/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('./base')

/**
 * This subscriber is purely for propagation of async context within the `asyncStart` event.
 * This will be typically used in a callback based scenario where there is async code getting
 * scheduled but not bound to the context.
 */
class PropagationSubscriber extends Subscriber {
  /**
   *
   * @param {object} params constructor params
   * @param {object} params.agent A New Relic Node.js agent instance.
   * @param {object} params.logger An agent logger instance.
   * @param {string} params.packageName The package name being instrumented.
   * This is what a developer would provide to the `require` function.
   * @param {string} params.channelName A unique name for the diagnostics channel
   * that will be created and monitored.
   * @param {number} params.callback position of callback if it needs to be wrapped for instrumentation. -1 means last argument
   */
  constructor({ agent, logger, packageName, channelName, callback }) {
    super({ agent, logger, packageName, channelName })
    this.callback = callback
    this.propagateContext = true
    this.events = ['asyncStart', 'asyncEnd']
  }
}

module.exports = PropagationSubscriber
