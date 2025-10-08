/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const PropagationSubscriber = require('../propagation')

/**
 * This susbscriber is necessary to propagate the context when
 * `Pool#getConnection` gets called.
 */
class MySQLPoolGetConnectionSubscriber extends PropagationSubscriber {
  constructor({ agent, logger, packageName = 'mysql', channelName = 'nr_poolGetConnection' }) {
    super({ agent, logger, packageName, channelName, callback: -1 })
  }

  handler(data, ctx) {
    // data.arguments only contains the callback(err, conn)
    return super.handler(data, ctx)
  }
}

module.exports = MySQLPoolGetConnectionSubscriber
