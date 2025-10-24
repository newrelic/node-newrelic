/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MySQLPoolQuerySubscriber = require('../mysql/pool-query.js')

/**
 * Subscribes to the events produced by `mysql2`'s `PoolNamespace#query`.
 */
class MySQL2PoolNamespaceQuerySubscriber extends MySQLPoolQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_poolNamespaceQuery', packageName = 'mysql2' }) {
    super({ agent, logger, channelName, packageName })
  }
}

module.exports = MySQL2PoolNamespaceQuerySubscriber
