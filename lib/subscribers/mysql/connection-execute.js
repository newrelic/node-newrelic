/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MySQL2ConnectionQuerySubscriber = require('./connection-query2')

/**
 * Subscribes to `mysql2`'s `Connection#execute` events.
 */
class MySQL2ConnectionExecuteSubscriber extends MySQL2ConnectionQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_connectionExecute', packageName = 'mysql2' }) {
    super({ agent, logger, channelName, packageName })
  }

  handler(data, ctx) {
    this.operation = 'execute'
    return super.handler(data, ctx)
  }
}

module.exports = MySQL2ConnectionExecuteSubscriber
