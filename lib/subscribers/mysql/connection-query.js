/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const DbQuerySubscriber = require('../db-query')
const { MYSQL } = require('#agentlib/metrics/names.js')
const { extractQueryArgs, getInstanceParameters } = require('./helper.js')
// const {EventEmitter} = require('node:events')

/**
 * Subscribes to the events produced by `mysql`'s `Connection#query`.
 */
class MySQLConnectionQuerySubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_connectionQuery', packageName = 'mysql' }) {
    super({ agent, logger, channelName, packageName, system: MYSQL.PREFIX })
    this.events = ['asyncStart', 'asyncEnd']
    this.operation = 'query'
    this.callback = -1
    this.propagateContext = true // required
  }

  handler(data, ctx) {
    const Connection = data?.self
    if (Connection.execute) {
      console.debug('not yet implemented, see lib/instrumentation/mysql.js:217')
    }
    // Set database attributes, explicitly setting the callback may or may not be necessary
    const { query, callback } = extractQueryArgs(data?.arguments)
    this.callback = callback
    this.queryString = query
    const parameters = getInstanceParameters(this.logger, Connection, query)
    this.parameters = parameters
    this.parameters.product = this.system

    // Call DbQuerySubscriber.handler to make the segment
    const newCtx = super.handler(data, ctx)
    // if (data?.arguments[0] instanceof EventEmitter) {
    //     this.wrapEventEmitter({ args: data.arguments, index: 0, name: 'emit', ctx: newCtx })
    // }
    return newCtx
  }
}

module.exports = MySQLConnectionQuerySubscriber
