/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbQuerySubscriber = require('../db-query.js')
const { POSTGRES } = require('#agentlib/metrics/names.js')

/**
 * Subscribes to the `query` event for PostgreSQL's (`pg`) `Client` class.
 */
class PgQuerySubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, channelName = 'nr_query', packageName = 'pg' }) {
    super({ agent, logger, channelName, packageName, system: POSTGRES.PREFIX })
    // Must track asyncStart for callback-based
    this.events = ['asyncStart', 'asyncEnd']
    this.operation = 'query'
    this.callback = -1
    this.propagateTx = true
  }

  /**
   * Extracts the PostgreSQL query from the function arguments.
   * @param {Array<*>} args arguments to the original Client.query call
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
    return super.handler(data, ctx)
  }

  enable() {
    super.enable()
    this.channel.asyncStart.bindStore(this.store, (data) => {
      const { transaction, segment } = data
      const ctx = this.agent.tracer.getContext()

      if (!(transaction && segment)) {
        this.logger.trace('No active transaction/segment, returning existing context')
        return ctx
      }
      const newCtx = ctx.enterSegment({ transaction, segment })
      return newCtx
    })
  }

  disable() {
    super.disable()
    this.channel.asyncStart.unbindStore(this.store)
  }
}

module.exports = PgQuerySubscriber
