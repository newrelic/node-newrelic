/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const DbQuerySubscriber = require('../db-query')
const { MYSQL } = require('#agentlib/metrics/names.js')
const { extractQueryArgs, getInstanceParameters } = require('./helper.js')

/**
 * Subscribes to the events produced by `mysql`'s `PoolNamespace#query`.
 */
class MySQLPoolNamespaceQuerySubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_poolNamespaceQuery', packageName = 'mysql' }) {
    super({ agent, logger, channelName, packageName, system: MYSQL.PREFIX })
    this.events = ['asyncStart', 'asyncEnd']
    this.operation = 'query'
    this.callback = -1
    // this if necessary, so that if we are in the the callback of pool.query(), the active segment is correct
    this.propagateContext = true
  }

  handler(data, ctx) {
    // TODO: Modify to support PoolNamespace, not Pool
    const PoolNamespace = data?.self
    if (PoolNamespace.execute) {
      console.debug('not implemented yet')
    }
    // Set database attributes, explicitly setting the callback may or may not be necessary
    const { query, callback } = extractQueryArgs(data?.arguments)
    this.callback = callback
    // this.queryString = query
    const parameters = getInstanceParameters(this.logger, PoolNamespace, query)
    this.parameters = parameters
    this.parameters.product = this.system

    const name = 'MySQL Pool#query'

    return this.createSegment({
      name,
      ctx
      // don't record this
    })
  }
}

module.exports = MySQLPoolNamespaceQuerySubscriber
