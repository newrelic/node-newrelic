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
    const proto = Object.getPrototypeOf(data.self)

    this.wrapPrototypeMethods(proto, CURSOR_METHODS, {
      getSegmentName: (cursor, method) => `${DB_METRIC_CONSTANTS.STATEMENT}/${this.system}/${cursor.namespace?.collection}/${method}`,
      // Resolve host details when the operation runs, not when the cursor is
      // constructed. See `WrapperSubscriber#wrapPrototypeMethods`. Newer drivers
      // expose the `MongoClient` at `cursor.client`; mongodb@4.1.x cursors
      // instead hold a `Topology` at `cursor.topology`. `getHostDetails`
      // resolves host/port from either shape.
      getParameters: (cursor) => {
        const details = getHostDetails(cursor.client ?? cursor.topology ?? cursor)
        return {
          host: details.host,
          port_path_or_id: details.port_path_or_id,
          database_name: cursor.namespace?.db,
          product: this.system
        }
      },
      getRecorderContext: (cursor, method) => {
        return {
          operation: method,
          collection: cursor.namespace?.collection,
          type: this.type
        }
      }
    })

    return ctx
  }
}
