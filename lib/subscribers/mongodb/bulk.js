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

/**
 * Resolves the `Collection` associated with a bulk operation. The driver stores
 * it at `this.s.collection` across all supported versions (4.x through 7.x) and
 * additionally exposes it at `this.collection` in newer versions.
 *
 * @param {object} bulkOperation A `BulkOperationBase` instance.
 * @returns {object|undefined} The associated `Collection`, if resolvable.
 */
function getBulkCollection(bulkOperation) {
  return bulkOperation.collection ?? bulkOperation.s?.collection
}

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
    const proto = Object.getPrototypeOf(data.self)

    this.wrapPrototypeMethods(proto, CURSOR_METHODS, {
      getSegmentName: (bulkOperation, method) => {
        const operation = bulkOperation.isOrdered ? 'orderedBulk' : 'unorderedBulk'
        const collectionName = getBulkCollection(bulkOperation)?.collectionName
        return `${DB_METRIC_CONSTANTS.STATEMENT}/${this.system}/${collectionName}/${operation}/batch`
      },
      // Resolve host details when the operation runs, not when the bulk
      // operation is constructed. See `WrapperSubscriber#wrapPrototypeMethods`.
      // A bulk operation references its `Collection`; resolve host/port through
      // the collection's owning `Db`/`MongoClient`.
      getParameters: (bulkOperation) => {
        const collection = getBulkCollection(bulkOperation)
        const details = getHostDetails(collection?.s?.db ?? collection?.client ?? collection ?? bulkOperation)
        return {
          host: details.host,
          port_path_or_id: details.port_path_or_id,
          database_name: details.database_name ?? collection?.dbName,
          product: this.system
        }
      },
      getRecorderContext: (bulkOperation) => {
        return {
          operation: bulkOperation.isOrdered ? 'orderedBulk' : 'unorderedBulk',
          collection: getBulkCollection(bulkOperation)?.collectionName,
          type: this.type
        }
      },
      getSegmentAttributes: (bulkOperation, method) => (
        ADMIN_COMMANDS.includes(method)
          ? { database_name: 'admin' }
          : {}
      )
    })

    return ctx
  }
}
