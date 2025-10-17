/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const DbQuerySubscriber = require('../db-query')
const { MYSQL } = require('#agentlib/metrics/names.js')
const { extractQueryArgs, getInstanceParameters } = require('./helper.js')
const symbols = require('../../symbols')

/**
 * Subscribes to the events produced by `mysql`'s `Pool#query`
 * and creates a special segment named 'MySQL Pool#query'.
 *
 * Also provides a base for other `Pool#query` subscribers.
 */
class MySQLPoolQuerySubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_poolQuery', packageName = 'mysql' }) {
    super({ agent, logger, channelName, packageName, system: MYSQL.PREFIX })
    this.events = ['asyncStart', 'asyncEnd']
    this.operation = 'query'
    this.callback = -1
    this.propagateContext = true
  }

  handler(data, ctx) {
    const Pool = data?.self
    // Setting this symbol is necessary because we
    // may need to track the databaseName across multiple
    // consecutive queries; see `getInstanceParameters`.
    Pool[symbols.storeDatabase] = true

    // Set database attributes, explicitly setting the callback may or may not be necessary
    const { query, callback } = extractQueryArgs(data?.arguments)
    this.callback = callback
    const parameters = getInstanceParameters(this.logger, Pool, query)
    this.parameters = parameters
    this.parameters.product = this.system

    // Create the segment, but don't supply a recorder
    const name = 'MySQL Pool#query'
    return this.createSegment({
      name,
      ctx
    })
  }
}

module.exports = MySQLPoolQuerySubscriber
