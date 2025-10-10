/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const DbQuerySubscriber = require('../db-query')
const { MYSQL } = require('#agentlib/metrics/names.js')
const { extractQueryArgs, getInstanceParameters } = require('./helper.js')
const symbols = require('../../symbols')

/**
 * Subscribes to `mysql`'s `Connection#query` events and creates the
 * coordinating Datastore query segment.
 *
 * Also provides a base for other `Connection#query` subscribers.
 */
class MySQLConnectionQuerySubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_connectionQuery', packageName = 'mysql' }) {
    super({ agent, logger, channelName, packageName, system: MYSQL.PREFIX })
    this.events = ['asyncStart', 'asyncEnd']
    this.operation = 'query'
    this.callback = -1
    this.propagateContext = true
  }

  handler(data, ctx) {
    const Connection = data?.self
    // Setting this symbol is necessary because we
    // may need to track the databaseName across multiple
    // consecutive queries; see `getInstanceParameters`.
    Connection[symbols.storeDatabase] = true

    // Set database attributes, explicitly setting the callback may or may not be necessary
    const { query, callback } = extractQueryArgs(data?.arguments)
    this.callback = callback
    this.queryString = query
    const parameters = getInstanceParameters(this.logger, Connection, query)
    this.parameters = parameters
    this.parameters.product = this.system

    // Call DbQuerySubscriber.handler to make the segment
    return super.handler(data, ctx)
  }
}

module.exports = MySQLConnectionQuerySubscriber
