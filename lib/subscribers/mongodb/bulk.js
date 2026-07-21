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

const ADMIN_COMMANDS = require('./utils/admin-commands.js')

/**
 * This list is a list of all methods we are interested in instrumenting,
 * regardless of client version. As we iterate through the list we will perform
 * a presence check for each method.
 *
 * @type {string[]}
 */
const CURSOR_METHODS = [
  'execute'
]

module.exports = class BulkSubscriber extends Wrapper {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      channelName: 'nr_bulk',
      packageName: 'mongodb',
      system: MONGODB_METRIC_CONSTANTS.PREFIX
    })
  }

  end(data, ctx) {
    const { self: bulkOperation, arguments: args } = data
    const [collection] = args
    const collectionName = collection.collectionName

    for (const method of CURSOR_METHODS) {
      if (typeof bulkOperation[method] !== 'function') {
        continue
      }

      this.wrapDatabaseMethod(bulkOperation, method, {
        getSegmentName: () => {
          const operation = bulkOperation.isOrdered ? 'orderedBulk' : 'unorderedBulk'
          return `${DB_METRIC_CONSTANTS.STATEMENT}/${this.system}/${collectionName}/${operation}/batch`
        },
        // Resolve host details when the operation runs, not when the bulk
        // operation is constructed. See `WrapperSubscriber#wrapDatabaseMethod`.
        getParameters: () => {
          const details = getHostDetails(collection)
          return {
            host: details.host,
            port_path_or_id: details.port_path_or_id,
            database_name: details.database_name,
            product: this.system
          }
        },
        getRecorderContext: () => {
          return {
            operation: bulkOperation.isOrdered ? 'orderedBulk' : 'unorderedBulk',
            collection: collectionName,
            type: this.type
          }
        },
        getSegmentAttributes: (method) => (
          ADMIN_COMMANDS.includes(method)
            ? { database_name: 'admin' }
            : {}
        )
      })
    }

    return ctx
  }
}
