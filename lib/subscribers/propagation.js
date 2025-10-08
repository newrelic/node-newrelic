/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('./base')

/**
 * This subscriber is purely for propagation of async context within the `asyncStart` event.
 * This will be typically used in a callback based scenario where there is async code getting scheduled
 * but not bound to the context.
 */
class PropagationSubscriber extends Subscriber {
  constructor({ agent, logger, packageName, channelName, callback }) {
    super({ agent, logger, packageName, channelName })
    this.callback = callback
    this.propagateContext = true
    this.events = ['asyncStart', 'asyncEnd']
  }
}

module.exports = PropagationSubscriber
