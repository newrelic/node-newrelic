/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Wrapper = require('./wrapper.js')
const getHostDetails = require('./utils/get-host-details.js')

const {
  DB: DB_METRIC_CONSTANTS,
  MONGODB: MONGODB_METRIC_CONSTANTS
} = require('#agentlib/metrics/names.js')

/**
 * This list is a list of all methods we are interested in instrumenting,
 * regardless of client version. As we iterate through the list we will perform
 * a presence check for each method.
 *
 * @type {string[]}
 */
const CURSOR_METHODS = [
  'count',
  'explain',
  // `forEach` is for mongodb@4 through mongodb@7. It is slated to be
  // removed in some version after 7.
  'forEach',
  'next',
  'nextObject',
  'toArray'
]

module.exports = class CursorSubscriber extends Wrapper {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      channelName: 'nr_cursor',
      packageName: 'mongodb',
      system: MONGODB_METRIC_CONSTANTS.PREFIX
    })
  }

  end(data, ctx) {
    const { self: dbClient, arguments: args } = data
    const [mongoClient, dbNamespace] = args
    const { collection } = dbNamespace
    const details = getHostDetails(mongoClient)
    this.parameters = {
      host: details.host,
      port_path_or_id: details.port_path_or_id,
      database_name: dbNamespace.db,
      product: this.system
    }

    for (const method of CURSOR_METHODS) {
      if (typeof dbClient[method] !== 'function') {
        continue
      }

      this.wrapDatabaseMethod(dbClient, method, {
        getSegmentName: (method) => `${DB_METRIC_CONSTANTS.STATEMENT}/${this.system}/${collection}/${method}`,
        getRecorderContext: (method) => {
          return {
            operation: method,
            collection,
            type: this.type
          }
        }
      })
    }

    return ctx
  }
}
