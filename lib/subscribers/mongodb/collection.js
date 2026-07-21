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
  'aggregate',
  'bulkWrite',
  'count',
  'createIndex',
  'deleteMany',
  'deleteOne',
  'distinct',
  'drop',
  'dropAllIndexes',
  'dropIndex',
  'ensureIndex',
  'findAndModify',
  'findAndRemove',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'geoHaystackSearch',
  'geoNear',
  'group',
  'indexExists',
  'indexInformation',
  'indexes',
  'insert',
  'insertMany',
  'insertOne',
  'isCapped',
  'mapReduce',
  'options',
  'parallelCollectionScan',
  'reIndex',
  'remove',
  'rename',
  'replaceOne',
  'save',
  'stats',
  'update',
  'updateMany',
  'updateOne'
]

module.exports = class CollectionSubscriber extends Wrapper {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      channelName: 'nr_collection',
      packageName: 'mongodb',
      system: MONGODB_METRIC_CONSTANTS.PREFIX
    })
  }

  end(data, ctx) {
    const { self: dbClient, arguments: args } = data
    const [dbInstance, collectionName] = args

    for (const method of CURSOR_METHODS) {
      if (typeof dbClient[method] !== 'function') {
        continue
      }

      this.wrapDatabaseMethod(dbClient, method, {
        getSegmentName: (method) => `${DB_METRIC_CONSTANTS.STATEMENT}/${this.system}/${collectionName}/${method}`,
        // Resolve host details when the operation runs, not when the
        // `Collection` handle is constructed. See
        // `WrapperSubscriber#wrapDatabaseMethod`.
        getParameters: () => {
          const details = getHostDetails(dbInstance)
          return {
            host: details.host,
            port_path_or_id: details.port_path_or_id,
            database_name: details.database_name,
            product: this.system
          }
        },
        getRecorderContext: (method) => {
          return {
            operation: method,
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
