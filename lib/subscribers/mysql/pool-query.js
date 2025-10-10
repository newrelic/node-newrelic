/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const DbQuerySubscriber = require('../db-query')
const { MYSQL } = require('#agentlib/metrics/names.js')
const { extractQueryArgs, getInstanceParameters } = require('./helper.js')

/**
 * Subscribes to the events produced by `mysql`'s `Pool#query`.
 */
class MySQLPoolQuerySubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_poolQuery', packageName = 'mysql' }) {
    super({ agent, logger, channelName, packageName, system: MYSQL.PREFIX })
    this.events = ['asyncStart', 'asyncEnd']
    this.operation = 'query'
    this.callback = -1
    // this if necessary, so that if we are in the the callback of pool.query(), the active segment is correct
    this.propagateContext = true
  }

  //   The goal is to replace the following shim-based code:

  //  return new QuerySpec({
  //     internal: false,
  //     stream: true,
  //     query: null,
  //     callback: extractedArgs.callback,
  //     name: 'MySQL Pool#query',
  //     record: false
  //   })

  handler(data, ctx) {
    const Pool = data?.self
    if (Pool.execute) {
      this.operation = 'execute'
    }
    // Set database attributes, explicitly setting the callback may or may not be necessary
    const { query, callback } = extractQueryArgs(data?.arguments)
    this.callback = callback
    const parameters = getInstanceParameters(this.logger, Pool, query)
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

module.exports = MySQLPoolQuerySubscriber
