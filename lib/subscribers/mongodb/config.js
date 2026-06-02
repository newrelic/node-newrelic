/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { COLLECTION_QUERY_OPS, CURSOR_OPS, DB_OPS, MONGO_VERSION_RANGE } = require('./constants')
const { collectionQueryConfig, cursorMethodConfig, dbOperationConfig } = require('./config-builder')

const collectionMapReduce = collectionQueryConfig('mapReduce', { versionRange: '>=4.1.4 <6.0.0' })
const collectionStats = collectionQueryConfig('stats', { versionRange: '>=4.1.4 <6.0.0' })
const collectionAggregate = {
  path: './mongodb/sync-query.js',
  instrumentations: [{
    channelName: 'nr_collection_aggregate',
    module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/collection.js' },
    functionQuery: { methodName: 'aggregate', kind: 'Sync' }
  }]
}

const cursorCount = {
  path: './mongodb/query.js',
  instrumentations: [
    {
      channelName: 'nr_cursor_count',
      module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/cursor/find_cursor.js' },
      functionQuery: { className: 'FindCursor', methodName: 'count', kind: 'Async' }
    }
  ]
}
const cursorExplain = {
  path: './mongodb/query.js',
  instrumentations: [
    {
      channelName: 'nr_cursor_explain',
      module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/cursor/find_cursor.js' },
      functionQuery: { className: 'FindCursor', methodName: 'explain', kind: 'Async' }
    },
    {
      channelName: 'nr_cursor_explain',
      module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/cursor/aggregation_cursor.js' },
      functionQuery: { className: 'AggregationCursor', methodName: 'explain', kind: 'Async' }
    }
  ]
}

const dbCollection = {
  path: './mongodb/sync-operation.js',
  instrumentations: [
    {
      channelName: 'nr_db_collection',
      module: { name: 'mongodb', versionRange: '>=4.1.4 <7.0.0', filePath: 'lib/db.js' },
      functionQuery: { className: 'Db', methodName: 'collection', kind: 'Sync' }
    },
    {
      channelName: 'nr_db_collection',
      module: { name: 'mongodb', versionRange: '>=7.0.0', filePath: 'lib/db.js' },
      functionQuery: { methodName: 'collection', kind: 'Sync' }
    }
  ]
}

const mongoClientConnect = {
  path: './mongodb/operation.js',
  instrumentations: [{
    channelName: 'nr_client_connect',
    module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/mongo_client.js' },
    functionQuery: { className: 'MongoClient', methodName: 'connect', kind: 'Async' }
  }]
}

const bulkExecute = {
  path: './mongodb/bulk.js',
  instrumentations: [
    {
      channelName: 'nr_bulk_execute',
      module: { name: 'mongodb', versionRange: '>=5.0.0', filePath: 'lib/bulk/common.js' },
      functionQuery: { className: 'BulkOperationBase', methodName: 'execute', kind: 'Async' }
    },
    {
      channelName: 'nr_bulk_execute',
      module: { name: 'mongodb', versionRange: '>=4.1.4 <5.0.0', filePath: 'lib/bulk/common.js' },
      functionQuery: { className: 'BulkOperationBase', methodName: 'execute', kind: 'Sync' }
    }
  ]
}

module.exports = {
  mongodb: [
    ...COLLECTION_QUERY_OPS.map((m) => collectionQueryConfig(m)),
    collectionAggregate,
    collectionMapReduce,
    collectionStats,
    ...CURSOR_OPS.map((m) => cursorMethodConfig(m)),
    cursorCount,
    cursorExplain,
    ...DB_OPS.map((m) => dbOperationConfig(m)),
    dbCollection,
    mongoClientConnect,
    bulkExecute
  ]
}
