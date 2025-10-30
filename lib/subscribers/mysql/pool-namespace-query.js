/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const MySQLPoolQuerySubscriber = require('./pool-query.js')

/**
 * Subscribes to the events produced by `mysql`'s `PoolNamespace#query`.
 *
 * Will be deleted when MySQL Pool#query segments are removed (@see https://github.com/newrelic/node-newrelic/issues/3482).
 */
class MySQLPoolNamespaceQuerySubscriber extends MySQLPoolQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_poolNamespaceQuery', packageName = 'mysql' }) {
    super({ agent, logger, channelName, packageName })
  }
}

module.exports = MySQLPoolNamespaceQuerySubscriber
