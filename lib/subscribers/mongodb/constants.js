/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// Earliest mongodb driver version supported.
const MONGO_VERSION_RANGE = '>=4.1.4'

// `Collection` methods to wrap. Methods that do not exist on a given driver
// version are skipped at wrap time, so version-specific methods (e.g.
// `mapReduce`, `stats`, removed in later majors) can be listed unconditionally.
const COLLECTION_OPS = [
  'aggregate',
  'bulkWrite',
  'count',
  'createIndex',
  'createIndexes',
  'deleteMany',
  'deleteOne',
  'distinct',
  'drop',
  'dropIndex',
  'dropIndexes',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'indexes',
  'indexExists',
  'indexInformation',
  'insert', // deprecated v4 wrapper, removed in mongodb@5
  'insertMany',
  'insertOne',
  'isCapped',
  'mapReduce', // removed in mongodb@6
  'options',
  'remove', // deprecated v4 wrapper, removed in mongodb@5
  'rename',
  'replaceOne',
  'stats', // removed in mongodb@6
  'update', // deprecated v4 wrapper, removed in mongodb@5
  'updateMany',
  'updateOne'
]

// `AbstractCursor` methods to wrap. `count` lives only on `FindCursor` and
// `explain` lives on both `FindCursor` and `AggregationCursor`; the prototype
// chain walk wraps each on its owning prototype.
const CURSOR_OPS = [
  'count',
  'explain',
  'forEach',
  'hasNext',
  'next',
  'toArray',
  'tryNext'
]

// `Db` methods to wrap. `collection` is the synchronous Collection factory.
const DB_OPS = [
  'addUser',
  'collection',
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
  COLLECTION_OPS,
  CURSOR_OPS,
  DB_OPS,
  MONGO_VERSION_RANGE
}
