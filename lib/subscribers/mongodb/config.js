/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { COLLECTION_QUERY_OPS, CURSOR_OPS, DB_OPS, MONGO_VERSION_RANGE } = require('./constants')
const { collectionQueryConfig, cursorMethodConfig, dbOperationConfig } = require('./config-builder')

// ---------------------------------------------------------------------------
// Collection — special cases that don't fit the standard query config
// ---------------------------------------------------------------------------

// Deprecated in v4/v5, removed in v6
const collectionMapReduce = collectionQueryConfig('mapReduce', { versionRange: '>=4.1.4 <6.0.0' })
// `stats` on Collection: removed in v6
const collectionStats = collectionQueryConfig('stats', {
  versionRange: '>=4.1.4 <6.0.0',
  channelName: 'nr_collection_stats'
})

// `count` appears on both Collection (deprecated but present in v4+) and FindCursor.
// Both fire the same channel so one subscriber instance handles both.
const collectionAndCursorCount = {
  path: './mongodb/query.js',
  instrumentations: [
    {
      channelName: 'nr_count',
      module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/collection.js' },
      functionQuery: { className: 'Collection', methodName: 'count', kind: 'Async' }
    },
    {
      channelName: 'nr_count',
      module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/cursor/find_cursor.js' },
      functionQuery: { className: 'FindCursor', methodName: 'count', kind: 'Async' }
    }
  ]
}

// `createIndex` exists on both Collection (query/statement) and Db (operation).
// They use different subscriber files so they need different channel names.
const collectionCreateIndex = collectionQueryConfig('createIndex', { channelName: 'nr_createIndex' })

// `indexInformation` exists on both Collection and Db — same collision pattern.
const collectionIndexInformation = collectionQueryConfig('indexInformation', { channelName: 'nr_indexInformation' })

// Collection.aggregate is a sync cursor factory (returns a cursor, no `async`
// keyword) in all v4+ versions.
const collectionAggregate = {
  path: './mongodb/sync-query.js',
  instrumentations: [{
    channelName: 'nr_aggregate',
    module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/collection.js' },
    functionQuery: { methodName: 'aggregate', kind: 'Sync' }
  }]
}

// ---------------------------------------------------------------------------
// Cursor — special cases that don't fit the standard cursor config
// ---------------------------------------------------------------------------

// `explain` on FindCursor and AggregationCursor — one subscriber handles both.
const cursorExplain = {
  path: './mongodb/query.js',
  instrumentations: [
    {
      channelName: 'nr_explain',
      module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/cursor/find_cursor.js' },
      functionQuery: { className: 'FindCursor', methodName: 'explain', kind: 'Async' }
    },
    {
      channelName: 'nr_explain',
      module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/cursor/aggregation_cursor.js' },
      functionQuery: { className: 'AggregationCursor', methodName: 'explain', kind: 'Async' }
    }
  ]
}

// ---------------------------------------------------------------------------
// Db — special cases that don't fit the standard operation config
// ---------------------------------------------------------------------------

// `createIndex` on Db: channel nr_db_createIndex (regex strips db_ prefix → createIndex)
const dbCreateIndex = dbOperationConfig('createIndex', { channelName: 'nr_db_createIndex' })
// `indexInformation` on Db: same collision with Collection.indexInformation
const dbIndexInformation = dbOperationConfig('indexInformation', { channelName: 'nr_db_indexInformation' })

// `collection` on Db: sync factory returning a Collection. Channel
// `nr_db_collection` so the regex strips db_ → 'collection'.
// Split across versions like dbOperationConfig: v7+ drops `className` because
// the `static {}` block in Db breaks orchestrion's className-based matcher.
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

// ---------------------------------------------------------------------------
// MongoClient.connect
// ---------------------------------------------------------------------------

// `connect` on MongoClient: produces `Datastore/operation/MongoDB/connect`.
// Static `MongoClient.connect(url, opts)` delegates to the instance method
// in v4+, so trapping the prototype call covers both forms.
const mongoClientConnect = {
  path: './mongodb/operation.js',
  instrumentations: [{
    channelName: 'nr_connect',
    module: { name: 'mongodb', versionRange: MONGO_VERSION_RANGE, filePath: 'lib/mongo_client.js' },
    functionQuery: { className: 'MongoClient', methodName: 'connect', kind: 'Async' }
  }]
}

// ---------------------------------------------------------------------------
// BulkOperationBase.execute
// ---------------------------------------------------------------------------

// In v4 execute(options, callback) is declared without `async`; v5+ uses `async execute()`.
// Two stanzas cover both so orchestrion finds the correct AST kind in each version.
const bulkExecute = {
  path: './mongodb/bulk.js',
  instrumentations: [
    {
      channelName: 'nr_execute',
      module: { name: 'mongodb', versionRange: '>=5.0.0', filePath: 'lib/bulk/common.js' },
      functionQuery: { className: 'BulkOperationBase', methodName: 'execute', kind: 'Async' }
    },
    {
      channelName: 'nr_execute',
      module: { name: 'mongodb', versionRange: '>=4.1.4 <5.0.0', filePath: 'lib/bulk/common.js' },
      functionQuery: { className: 'BulkOperationBase', methodName: 'execute', kind: 'Sync' }
    }
  ]
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = {
  mongodb: [
    // Collection — standard async query operations
    ...COLLECTION_QUERY_OPS.map((m) => collectionQueryConfig(m)),

    // Collection — special cases
    collectionAggregate,
    collectionAndCursorCount,
    collectionCreateIndex,
    collectionIndexInformation,
    collectionMapReduce,
    collectionStats,

    // Cursor — standard async operations
    ...CURSOR_OPS.map((m) => cursorMethodConfig(m)),

    // Cursor — special cases
    cursorExplain,

    // Db — standard async operations
    ...DB_OPS.map((m) => dbOperationConfig(m)),

    // Db — special cases
    dbCollection,
    dbCreateIndex,
    dbIndexInformation,

    // MongoClient
    mongoClientConnect,

    // Bulk
    bulkExecute
  ]
}
