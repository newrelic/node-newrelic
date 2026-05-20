/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { MONGO_VERSION_RANGE } = require('./constants')

/**
 * Builds an instrumentation entry for a Collection method that records a
 * statement-style query segment.
 *
 * @param {string} method - The Collection method name (e.g. 'insertOne').
 * @param {object} [opts] - Optional overrides for non-default methods.
 * @param {string} [opts.versionRange] - Override the default mongodb version range.
 * @param {string} [opts.kind] - 'Async' (default) or 'Sync' for orchestrion's AST matcher.
 * @param {string} [opts.channelName] - Override the default channel name `nr_${method}`.
 * @returns {object} Subscriber config entry.
 */
function collectionQueryConfig(method, { versionRange = MONGO_VERSION_RANGE, kind = 'Async', channelName } = {}) {
  return {
    path: './mongodb/query.js',
    instrumentations: [{
      channelName: channelName ?? `nr_${method}`,
      module: { name: 'mongodb', versionRange, filePath: 'lib/collection.js' },
      functionQuery: { className: 'Collection', methodName: method, kind }
    }]
  }
}

/**
 * Builds an instrumentation entry for a Db method that records an
 * operation-style segment.  Db is split across two version ranges because v7+
 * introduced `static {}` blocks in the Db class which trip orchestrion's
 * `traceInstanceMethod` path; for v7+ we drop `className` and rely on
 * `methodName` alone (Db is the only class in db.js so there is no ambiguity).
 *
 * @param {string} method - The Db method name (e.g. 'command').
 * @param {object} [opts] - Optional overrides for collisions with Collection methods.
 * @param {string} [opts.channelName] - Override the default channel name `nr_${method}`.
 * @returns {object} Subscriber config entry.
 */
function dbOperationConfig(method, { channelName } = {}) {
  const ch = channelName ?? `nr_${method}`
  return {
    path: './mongodb/operation.js',
    instrumentations: [
      {
        channelName: ch,
        module: { name: 'mongodb', versionRange: '>=4.1.4 <7.0.0', filePath: 'lib/db.js' },
        functionQuery: { className: 'Db', methodName: method, kind: 'Async' }
      },
      {
        channelName: ch,
        module: { name: 'mongodb', versionRange: '>=7.0.0', filePath: 'lib/db.js' },
        functionQuery: { methodName: method, kind: 'Async' }
      }
    ]
  }
}

/**
 * Builds an instrumentation entry for an AbstractCursor method.  Split across
 * two version ranges:
 *   v4-v6: AbstractCursor has multiple non-class definitions of names like
 *          `next` / `tryNext` (e.g. on iterator objects).  Pin to
 *          `className: 'AbstractCursor'` to avoid matching the wrong function.
 *   v7+:   AbstractCursor contains a `static {}` block which breaks the
 *          className-based traceInstanceMethod path; use `methodName` alone.
 *
 * @param {string} method - The cursor method name (e.g. 'next').
 * @returns {object} Subscriber config entry.
 */
function cursorMethodConfig(method) {
  return {
    path: './mongodb/query.js',
    instrumentations: [
      {
        channelName: `nr_${method}`,
        module: { name: 'mongodb', versionRange: '>=4.1.4 <7.0.0', filePath: 'lib/cursor/abstract_cursor.js' },
        functionQuery: { className: 'AbstractCursor', methodName: method, kind: 'Async' }
      },
      {
        channelName: `nr_${method}`,
        module: { name: 'mongodb', versionRange: '>=7.0.0', filePath: 'lib/cursor/abstract_cursor.js' },
        functionQuery: { methodName: method, kind: 'Async' }
      }
    ]
  }
}

module.exports = {
  collectionQueryConfig,
  cursorMethodConfig,
  dbOperationConfig
}
