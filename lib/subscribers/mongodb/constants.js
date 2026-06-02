/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Earliest mongodb driver version supported
const MONGO_VERSION_RANGE = '>=4.1.4'

// Collection methods that use the collection config that is
// built by `collectionQueryConfig` in config-builder.
const COLLECTION_QUERY_OPS = [
  'bulkWrite',
  'count',
  'countDocuments', // Newer version of Collection.count
  'createIndex',
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
  'indexInformation',
  'insertMany',
  'insertOne',
  'isCapped',
  'options',
  'rename',
  'replaceOne',
  'updateMany',
  'updateOne'
]

// AbstractCursor methods that use the cursor config that is
// built by `cursorMethodConfig` in config-builder.
const CURSOR_OPS = [
  'forEach',
  'hasNext',
  'next',
  'toArray',
  'tryNext'
]

// Db methods that use the standard operation config that is
// built by `dbOperationConfig` in config-builder.
const DB_OPS = [
  'addUser',
  'collections',
  'command',
  'createCollection',
  'createIndex',
  'dropCollection',
  'dropDatabase',
  'indexInformation',
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
