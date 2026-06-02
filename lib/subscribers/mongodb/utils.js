/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Resolves the MongoClient instance from any MongoDB internal object.
 *
 * @param {object} obj - A MongoDB internal object.
 * @returns {object|null} The MongoClient (or Topology), or null if not found.
 */
function findClient(obj) {
  if (!obj) return null

  // A client-like object is valid only if it exposes `s.options.hosts`; several
  // of the paths below can be truthy without being the client object we want.
  function validClient(candidate) {
    return candidate?.s?.options?.hosts ? candidate : null
  }

  return validClient(obj) ??              // MongoClient
    validClient(obj.client) ??            // Collection / Db / Cursor (v5+)
    validClient(obj.cursorClient) ??      // AbstractCursor (v5+)
    validClient(obj.s?.db?.s?.client) ??  // Collection (v4)
    validClient(obj.s?.client) ??         // Db (v4)
    validClient(obj.topology)             // Cursor (v4.1-v4.3, Topology has same shape)
}

/**
 * Resolves the database name from any MongoDB internal object.
 *
 * @param {object} obj - A MongoDB internal object.
 * @returns {string|null} The database name, or null.
 */
function findDatabaseName(obj) {
  if (!obj) return null
  return obj.databaseName ??         // Db
    obj.dbName ??                    // Collection
    obj.cursorNamespace?.db ??       // AbstractCursor (v5+)
    obj.namespace?.db ??             // AbstractCursor (v4)
    null
}

/**
 * Resolves the collection name from any MongoDB internal object.
 *
 * @param {object} obj - A MongoDB internal object.
 * @returns {string} The collection name, or 'unknown'.
 */
function findCollectionName(obj) {
  if (!obj) return 'unknown'
  return obj.collectionName ??              // Collection
    obj.cursorNamespace?.collection ??      // AbstractCursor (v5+)
    obj.namespace?.collection ??            // AbstractCursor (v4)
    'unknown'
}

/**
 * Builds the standard `this.parameters` object used by DbSubscriber.addAttributes.
 * Resolves host, port, database name, and product from any MongoDB internal object.
 *
 * @param {object} mongoObject - A MongoDB internal object (Collection, Cursor, Db, etc.)
 * @param {string} system - The database system name (e.g. 'MongoDB').
 * @returns {object} The parameters object.
 */
function getParameters(mongoObject, system) {
  const client = findClient(mongoObject)
  const hosts = client?.s?.options?.hosts
  const host = hosts?.[0]?.host ?? null
  const port = hosts?.[0]?.port ?? null

  return {
    product: system,
    host,
    port_path_or_id: port,
    database_name: findDatabaseName(mongoObject)
  }
}

/**
 * Derives the operation name from a channel name by stripping the `nr_` prefix
 * and any optional lowercase class-qualifier (e.g. `nr_db_createIndex` →
 * `createIndex`, `nr_count` → `count`).
 *
 * @param {string} channelName - The diagnostics channel name.
 * @returns {string} The operation name.
 */
function operationFromChannel(channelName) {
  return channelName.replace(/^nr_(?:[a-z]+_)?/, '')
}

module.exports = { findCollectionName, getParameters, operationFromChannel }
