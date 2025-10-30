/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbQuerySubscriber = require('../db-query.js')
const { POSTGRES } = require('#agentlib/metrics/names.js')
const { EventEmitter } = require('node:events')

/**
 * Defaults to subscribing to the `query` event for PostgreSQL's (`pg`) `Client` class
 * (`pg/lib/client.js`).
 *
 * Also, provides an base for PG native query subscribers.
 */
class PgQuerySubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_query', packageName = 'pg' }) {
    super({ agent, logger, channelName, packageName, system: POSTGRES.PREFIX })
    this.events = ['asyncEnd']
    this.operation = 'query'
    this.callback = -1
  }

  /**
   * Extracts the PostgreSQL query from the function arguments.
   * @param {object[]} args arguments to the original Client.query call
   * @returns {string} the query string
   */
  getQuery(args) {
    const config = args[0]
    let statement
    if (config && (typeof config === 'string' || config instanceof String)) {
      statement = config
    } else if (config && config.text) {
      statement = config.text
    } else {
      // Won't be matched by SQL parser, but should be handled properly
      statement = 'Other'
    }
    return statement
  }

  setParameters(client) {
    this.parameters = {}
    this.parameters.product = this.system
    this.parameters.database_name = client?.database
    this.parameters.host = client?.host
    this.parameters.port_path_or_id = client?.port
  }

  handler(data, ctx) {
    this.queryString = this.getQuery(data?.arguments)
    this.setParameters(data?.self)
    // call the super to create the segment and return new context
    // then wrap the arguments and bind the new context to the event emitter
    const newCtx = super.handler(data, ctx)
    if (data?.arguments[0] instanceof EventEmitter) {
      this.wrapEventEmitter({ args: data.arguments, index: 0, ctx: newCtx })
    }
    return newCtx
  }
}

module.exports = PgQuerySubscriber
