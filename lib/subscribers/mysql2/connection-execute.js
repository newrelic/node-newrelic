/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MySQL2ConnectionQuerySubscriber = require('../mysql/connection-query')

/**
 * Subscribes to `mysql2`'s `Connection#execute` events.
 */
class MySQL2ConnectionExecuteSubscriber extends MySQL2ConnectionQuerySubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, channelName: 'nr_connectionExecute', packageName: 'mysql2' })
    this.operation = 'execute'
  }
}

module.exports = MySQL2ConnectionExecuteSubscriber
