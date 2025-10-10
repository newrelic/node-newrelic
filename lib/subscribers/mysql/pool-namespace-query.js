/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MySQLPoolQuerySubscriber = require('./pool-query.js')

/**
 * Subscribes to the events produced by `mysql`'s `PoolNamespace#query`.
 */
class MySQLPoolNamespaceQuerySubscriber extends MySQLPoolQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_poolNamespaceQuery', packageName = 'mysql' }) {
    super({ agent, logger, channelName, packageName })
  }
}

module.exports = MySQLPoolNamespaceQuerySubscriber
