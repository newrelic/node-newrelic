/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MySQLConnectionQuerySubscriber = require('../mysql/connection-query')

/**
 * Subscribes to `mysql2`'s `Connection#query` events.
 */
class MySQL2ConnectionQuerySubscriber extends MySQLConnectionQuerySubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'mysql2' })
  }
}

module.exports = MySQL2ConnectionQuerySubscriber
