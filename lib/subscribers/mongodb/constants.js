/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Earliest mongodb driver version supported
const MONGO_VERSION_RANGE = '>=4.1.4'

// Collection methods that use the standard async query config (kind:'Async',
// path:'./mongodb/query.js', channelName:`nr_${method}`).  Methods with
// collisions, version restrictions, or non-async semantics live as explicit
// entries in config.js.
const COLLECTION_QUERY_OPS = [
  'bulkWrite',
  'countDocuments',
  'createIndexes',
  'deleteMany',
  'deleteOne',
  'distinct',
  'drop',
  'dropIndex',
  'dropIndexes',
  'estimatedDocumentCount',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'indexes',
  'indexExists',
  'insertMany',
  'insertOne',
  'isCapped',
  'options',
  'rename',
  'replaceOne',
  'updateMany',
  'updateOne'
]

// AbstractCursor methods that use the standard cursor config (kind:'Async',
// path:'./mongodb/query.js').  `explain` collides across FindCursor /
// AggregationCursor and lives as an explicit entry in config.js.
const CURSOR_OPS = [
  'forEach',
  'hasNext',
  'next',
  'toArray',
  'tryNext'
]

// Db methods that use the standard operation config (kind:'Async',
// path:'./mongodb/operation.js').  `createIndex` and `indexInformation`
// collide with Collection.* of the same name and live as explicit entries.
const DB_OPS = [
  'addUser',
  'collections',
  'command',
  'createCollection',
  'dropCollection',
  'dropDatabase',
  'profilingLevel',
  'removeUser',
  'renameCollection',
  'setProfilingLevel',
  'stats'
]

module.exports = {
  COLLECTION_QUERY_OPS,
  CURSOR_OPS,
  DB_OPS,
  MONGO_VERSION_RANGE
}
