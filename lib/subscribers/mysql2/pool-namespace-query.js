/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MySQLPoolNamespaceQuerySubscriber = require('../mysql/pool-namespace-query.js')

/**
 * Subscribes to the events produced by `mysql2`'s `PoolNamespace#query`.
 */
class MySQL2PoolNamespaceQuerySubscriber extends MySQLPoolNamespaceQuerySubscriber {
  constructor({ agent, logger }) {
    super({ agent, logger, packageName: 'mysql2' })
  }
}

module.exports = MySQL2PoolNamespaceQuerySubscriber
