/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const Subscriber = require('./base')
const MiddlewareWrapper = require('./middleware-wrapper')

class MiddlewareSubscriber extends Subscriber {
  constructor({ agent, logger, packageName, channelName, system }) {
    super({ agent, logger, packageName, channelName })
    // this is because the handler simply wraps a function
    // that is executed later when a request is made
    this.requireActiveTx = false
    this.wrapper = new MiddlewareWrapper({ agent, logger, system })
  }
}

module.exports = MiddlewareSubscriber
