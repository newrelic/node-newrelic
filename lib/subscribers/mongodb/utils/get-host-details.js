/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const LOCALHOST_ALIASES = [
  '127.0.0.1',
  '::1',
  '[::1]'
]

/**
 * @typedef {object} MongodbHostDetails
 * @property {string} [database_name] The name of the database.
 * @property {string} host The first host being targeted by the connection.
 * @property {string|number} port_path_or_id The destination port associated
 * with `host`.
 */

/**
 * Retrieves the connection details (host, port, collection_name) from the
 * provided MongoDB object instance. Over versions of the driver, the location
 * of these details get moved around. So we need to inspect various locations
 * for availability and use the first one we can find.
 *
 * Important: in the case where the `mongoObject` is a direct instance of
 * `MongoClient`, or other object that does not include database name details,
 * the `database_name` field will be omitted. You must acquire this through
 * other means.
 *
 * @param {object} mongoObject The MongoDB driver object to get the details
 * from, e.g. an 'AbstractCursor' or 'BulkOperationBase' instance.
 *
 * @returns {MongodbHostDetails}
 */
module.exports = function getHostDetails(mongoObject) {
  // We prefer to get the details from the "client" object. This is the object
  // the driver returns when you do `require('mongodb').MongoClient.connect()`.

  let databaseName
  let host
  let port

  if (mongoObject.constructor.name === 'MongoClient') {
    host = mongoObject.options.hosts[0].host
    port = mongoObject.options.hosts[0].port
  } else if (mongoObject?.databaseName && mongoObject?.client) {
    // Direct `Db` instance.
    databaseName = mongoObject.databaseName
    host = mongoObject.client.options.hosts[0].host
    port = mongoObject.client.options.hosts[0].port
  } else if (mongoObject.dbName && mongoObject.s?.db?.s?.client?.options) {
    // Likely an instance of `Collection`.
    databaseName = mongoObject.dbName
    host = mongoObject.s.db.s.client.options.hosts[0].host
    port = mongoObject.s.db.s.client.options.hosts[0].port
  } else if (mongoObject.databaseName && mongoObject.s?.client?.options) {
    // Some `mongodb@4` object.
    databaseName = mongoObject.databaseName
    host = mongoObject.s.client.options.hosts[0].host
    port = mongoObject.s.client.options.hosts[0].port
  } else if (mongoObject?.s?.db && mongoObject.s.db.client) {
    // mongodb@5 bulk operation
    databaseName = mongoObject.s.db.databaseName
    host = mongoObject.s.db.client.options.hosts[0].host
    port = mongoObject.s.db.client.options.hosts[0].port
  } else if (mongoObject.constructor.name === 'Topology') {
    // A "topology" object (from ancient times). Remove this when we drop
    // support for v4.
    host = mongoObject.s.options.hosts[0].host
    port = mongoObject.s.options.hosts[0].port
  }

  if (LOCALHOST_ALIASES.includes(host) === true) {
    host = 'localhost'
  }

  return {
    database_name: databaseName,
    port_path_or_id: port,
    host
  }
}
