/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MySQLConnectionQuerySubscriber = require('./connection-query')

/**
 * Subscribes to `mysql2`'s `Connection#query` events.
 */
class MySQL2ConnectionQuerySubscriber extends MySQLConnectionQuerySubscriber {
  constructor({ agent, logger, packageName = 'mysql2', channelName = 'nr_connectionQuery2' }) {
    super({ agent, logger, packageName, channelName })
  }
}

module.exports = MySQL2ConnectionQuerySubscriber
