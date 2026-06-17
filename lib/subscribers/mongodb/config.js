/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { MONGO_VERSION_RANGE } = require('./constants')

// Each entry hooks a class constructor (a `functionQuery` with a `className`
// and no `methodName`). The subscriber uses that hook to wrap the relevant
// prototype methods once at runtime, keeping the code transformer to a single
// AST traversal per driver file.
module.exports = {
  mongodb: [
    {
      path: './mongodb/collection.js',
      instrumentations: [{
        channelName: 'nr_mongodb_collection',
        module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/collection.js' },
        functionQuery: { className: 'Collection' }
      }]
    },
    {
      path: './mongodb/db.js',
      instrumentations: [{
        channelName: 'nr_mongodb_db',
        module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/db.js' },
        functionQuery: { className: 'Db' }
      }]
    },
    {
      path: './mongodb/cursor.js',
      instrumentations: [{
        channelName: 'nr_mongodb_cursor',
        module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/cursor/abstract_cursor.js' },
        functionQuery: { className: 'AbstractCursor' }
      }]
    },
    {
      path: './mongodb/bulk.js',
      instrumentations: [{
        channelName: 'nr_mongodb_bulk',
        module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/bulk/common.js' },
        functionQuery: { className: 'BulkOperationBase' }
      }]
    },
    {
      path: './mongodb/client.js',
      instrumentations: [{
        channelName: 'nr_mongodb_client',
        module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/mongo_client.js' },
        functionQuery: { className: 'MongoClient' }
      }]
    }
  ]
}
