/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const Subscriber = require('../base')
const symbols = require('../../symbols')

/**
 * Subscribes to the events produced by `mysql`'s `Pool#query`
 * and creates a special segment named 'MySQL Pool#query'.
 *
 * Also provides a base for other `Pool#query` subscribers.
 *
 * Will be deleted when MySQL Pool#query segments are removed (@see https://github.com/newrelic/node-newrelic/issues/3482).
 */
class MySQLPoolQuerySubscriber extends Subscriber {
  constructor({ agent, logger, channelName = 'nr_poolQuery', packageName = 'mysql' }) {
    super({ agent, logger, channelName, packageName })
    this.events = ['asyncStart', 'asyncEnd']
    this.callback = -1
    this.propagateContext = true
  }

  handler(data, ctx) {
    const Pool = data?.self
    // Setting this symbol is necessary because we
    // may need to track the databaseName across multiple
    // consecutive queries; see `getInstanceParameters`.
    Pool[symbols.storeDatabase] = true

    // Create the segment, but don't supply a recorder
    const name = 'MySQL Pool#query'
    return this.createSegment({
      name,
      ctx
    })
  }
}

module.exports = MySQLPoolQuerySubscriber
