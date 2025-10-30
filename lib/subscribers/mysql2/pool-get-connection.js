/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MySqlPoolGetConnectionSubscriber = require('../mysql/pool-get-connection')

/**
 * This subscriber is only required to propagate the context within
 * `Pool#getConnection`.
 *
 * Will be deleted when MySQL Pool#query segments are removed (@see https://github.com/newrelic/node-newrelic/issues/3482).
 */
class MySQL2PoolGetConnectionSubscriber extends MySqlPoolGetConnectionSubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'mysql2' })
  }
}

module.exports = MySQL2PoolGetConnectionSubscriber
