/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MySQLPoolQuerySubscriber = require('../mysql/pool-query.js')

/**
 * Subscribes to the events produced by `mysql2`'s `Pool#query`.
 *
 * Will be deleted when MySQL Pool#query segments are removed (@see https://github.com/newrelic/node-newrelic/issues/3482).
 */
class MySQL2PoolQuerySubscriber extends MySQLPoolQuerySubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'mysql2' })
  }
}

module.exports = MySQL2PoolQuerySubscriber
