/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MySQLPoolQuerySubscriber = require('../mysql/pool-query.js')

/**
 * Subscribes to the events produced by `mysql2`'s `Pool#query`.
 */
class MySQL2PoolQuerySubscriber extends MySQLPoolQuerySubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'mysql2' })
  }
}

module.exports = MySQL2PoolQuerySubscriber
