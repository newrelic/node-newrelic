/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { MONGO_VERSION_RANGE } = require('./constants')

/**
 * Builds an instrumentation entry for a `Collection` class method
 * with kind 'Async'.
 *
 * @param {string} method - The Collection method name (e.g. 'insertOne').
 * @param {object} [opts] - Optional overrides.
 * @param {string} [opts.versionRange] - Override the default mongodb version range.
 * @param {string} [opts.channelName] - Override the default channel name `nr_${method}`.
 * @returns {object} Subscriber config entry.
 */
function collectionQueryConfig(method, { versionRange = MONGO_VERSION_RANGE, channelName } = {}) {
  return {
    path: './mongodb/query.js',
    instrumentations: [{
      channelName: channelName ?? `nr_collection_${method}`,
      module: { name: 'mongodb', versionRange, filePath: 'lib/collection.js' },
      functionQuery: { className: 'Collection', methodName: method, kind: 'Async' }
    }]
  }
}

/**
 * Builds an instrumentation entry for an `AbstractCursor` class method
 * with kind 'Sync'.
 *
 * @param {string} method - The cursor method name (e.g. 'next').
 * @returns {object} Subscriber config entry.
 */
function cursorMethodConfig(method) {
  const instrumentations = [
    {
      channelName: `nr_cursor_${method}`,
      module: { name: 'mongodb', versionRange: '>=4.1.4 <7.0.0', filePath: 'lib/cursor/abstract_cursor.js' },
      functionQuery: { className: 'AbstractCursor', methodName: method, kind: 'Sync' }
    },
    {
      channelName: `nr_cursor_${method}`,
      module: { name: 'mongodb', versionRange: '>=7.0.0', filePath: 'lib/cursor/abstract_cursor.js' },
      functionQuery: { methodName: method, kind: 'Sync' }
    }
  ]
  return {
    path: './mongodb/query.js',
    instrumentations
  }
}

/**
 * Builds an instrumentation entry for a `Db` class method
 * with kind 'Async'.
 *
 * @param {string} method - The Db method name (e.g. 'command').
 * @param {object} [opts] - Optional overrides.
 * @param {string} [opts.channelName] - Override the default channel name `nr_${method}`.
 * @returns {object} Subscriber config entry.
 */
function dbOperationConfig(method, { channelName } = {}) {
  const instrumentations = [
    {
      channelName: channelName ?? `nr_db_${method}`,
      module: { name: 'mongodb', versionRange: '>=4.1.4 <7.0.0', filePath: 'lib/db.js' },
      functionQuery: { className: 'Db', methodName: method, kind: 'Async' }
    },
    {
      channelName: channelName ?? `nr_db_${method}`,
      module: { name: 'mongodb', versionRange: '>=7.0.0', filePath: 'lib/db.js' },
      functionQuery: { methodName: method, kind: 'Async' }
    }
  ]
  return {
    path: './mongodb/operation.js',
    instrumentations
  }
}

module.exports = {
  collectionQueryConfig,
  cursorMethodConfig,
  dbOperationConfig
}
