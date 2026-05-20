/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Returns the Collection object from a BulkOperationBase, handling v4 (this.s.collection)
 * and v5+ (this.collection) storage layouts.
 *
 * @param {object} bulk - A BulkOperationBase instance.
 * @returns {object|null} The Collection, or null.
 */
function bulkCollection(bulk) {
  return bulk?.collection ?? bulk?.s?.collection ?? null
}

// Property paths that may resolve to a MongoClient on a given MongoDB object.
// Covers MongoClient, Collection, Db, AbstractCursor, and the v4.1-v4.3 cursor
// variant that holds a Topology in place of a client (Topology exposes the same
// `s.options.hosts` shape).
const CLIENT_PATHS = [
  (o) => o,                   // MongoClient
  (o) => o?.client,           // Collection / Db / Cursor (v5+)
  (o) => o?.cursorClient,     // AbstractCursor (v5+)
  (o) => o?.s?.db?.s?.client, // Collection (v4)
  (o) => o?.s?.client,        // Db (v4)
  (o) => o?.topology          // Cursor (v4.1-v4.3)
]

/**
 * Resolves the MongoClient instance from any MongoDB internal object.
 * For BulkOperationBase, recurses through the underlying Collection.
 *
 * @param {object} obj - A MongoDB internal object.
 * @returns {object|null} The MongoClient (or Topology), or null if not found.
 */
function findClient(obj) {
  if (!obj) return null
  for (const get of CLIENT_PATHS) {
    const candidate = get(obj)
    if (candidate?.s?.options?.hosts) return candidate
  }
  const coll = bulkCollection(obj)
  return coll ? findClient(coll) : null
}

/**
 * Resolves the database name from any MongoDB internal object.
 * For BulkOperationBase, recurses through the underlying Collection.
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
    findDatabaseName(bulkCollection(obj))
}

/**
 * Resolves the collection name from any MongoDB internal object.
 * For BulkOperationBase, recurses through the underlying Collection.
 *
 * @param {object} obj - A MongoDB internal object.
 * @returns {string} The collection name, or 'unknown'.
 */
function findCollectionName(obj) {
  if (!obj) return 'unknown'
  const coll = bulkCollection(obj)
  return obj.collectionName ??              // Collection
    obj.cursorNamespace?.collection ??      // AbstractCursor (v5+)
    obj.namespace?.collection ??            // AbstractCursor (v4)
    (coll && findCollectionName(coll)) ??
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

module.exports = { bulkCollection, findCollectionName, getParameters }
