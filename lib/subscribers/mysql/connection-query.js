/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const DbQuerySubscriber = require('../db-query')
const { MYSQL } = require('#agentlib/metrics/names.js')
const { extractQuery, getInstanceParameters } = require('./helper.js')
const symbols = require('../../symbols')
const { EventEmitter } = require('node:events')

/**
 * Subscribes to `mysql`'s `Connection#query` events and creates the
 * coordinating Datastore query segment.
 *
 * Also provides a base for other `Connection#query` subscribers.
 */
class MySQLConnectionQuerySubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_connectionQuery', packageName = 'mysql' }) {
    super({ agent, logger, channelName, packageName, system: MYSQL.PREFIX })
    this.events = ['asyncStart', 'asyncEnd', 'end']
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

    // Set database attributes
    this.queryString = extractQuery(data?.arguments)
    this.parameters = getInstanceParameters(this.logger, Connection, this.queryString)
    this.parameters.product = this.system

    // Call DbQuerySubscriber.handler to make the segment
    return super.handler(data, ctx)
  }

  end(data) {
    const ctx = this.agent.tracer.getContext()
    if (ctx?.transaction?.isActive() !== true) {
      return
    }

    if (data?.result instanceof EventEmitter) {
      const ctx = this.agent.tracer.getContext()
      this.wrapEventEmitter({ args: data, index: 'result', ctx })
    }
  }
}

module.exports = MySQLConnectionQuerySubscriber
