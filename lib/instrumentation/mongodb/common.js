/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  QuerySpec,
  OperationSpec,
  params: { DatastoreParameters }
} = require('../../shim/specs')
const { CURSOR_OPS, COLLECTION_OPS, DB_OPS } = require('./constants')
const common = module.exports

/**
 * Instruments all methods from constants.CURSOR_OPS on a given
 * cursor class
 *
 * @param {Shim} shim instance of shim
 * @param {Cursor} Cursor mongodb Cursor prototype
 */
common.instrumentCursor = function instrumentCursor(shim, Cursor) {
  if (Cursor && Cursor.prototype) {
    const proto = Cursor.prototype
    shim.recordQuery(proto, CURSOR_OPS, common.makeQueryDescFunc)
    shim.recordQuery(proto, 'each', common.makeQueryDescFunc)
    shim.recordOperation(proto, 'pipe', new OperationSpec({ opaque: true, name: 'pipe' }))
  }
}

/**
 * Instruments all methods from constants.COLLECTION_OPS on
 * the Collection class
 *
 * @param {Shim} shim instance of shim
 * @param {Collection} Collection mongodb Collection prototype
 */
common.instrumentCollection = function instrumentCollection(shim, Collection) {
  if (Collection && Collection.prototype) {
    const proto = Collection.prototype
    shim.recordQuery(proto, COLLECTION_OPS, common.makeQueryDescFunc)
  }
}

/**
 * Instruments the execute method on
 * the BulkOperationBase class
 *
 * @param {Shim} shim instance of shim
 * @param {BulkOperationModule} BulkOperationModule operation module, typically from mongodb/lib/bulk/common
 */
common.instrumentBulkOperation = function instrumentBulkOperation(shim, BulkOperationModule) {
  if (BulkOperationModule?.BulkOperationBase?.prototype) {
    const proto = BulkOperationModule.BulkOperationBase.prototype
    shim.recordBatchQuery(proto, 'execute', common.makeBulkDescFunc(shim, 'execute'))
  }
}

/**
 * Instruments all methods from constants.DB_OPS on
 * the Db class.
 *
 * @param {Shim} shim instance of shim
 * @param {Db} Db mongodb Db prototype
 */
common.instrumentDb = function instrumentDb(shim, Db) {
  if (Db && Db.prototype) {
    const proto = Db.prototype
    shim.recordOperation(proto, DB_OPS, function makeOperationDescFunc(shim, _fn, methodName) {
      return new OperationSpec({
        callback: shim.LAST,
        opaque: true,
        promise: true,
        name: methodName
      })
    })
    // link to client.connect(removed in v4.0)
    shim.recordOperation(
      Db,
      'connect',
      new OperationSpec({ callback: shim.LAST, promise: true, name: 'connect' })
    )
  }
}

/**
 * Sets up the desc for all instrumented query methods
 *
 * @param {Shim} shim instance of shim
 * @param {Function} _fn function getting instrumented
 * @param {string} methodName name of function
 * @returns {QuerySpec} query spec
 */
common.makeQueryDescFunc = function makeQueryDescFunc(shim, _fn, methodName) {
  if (methodName === 'each') {
    const parameters = getInstanceAttributeParameters(shim, this)
    return new QuerySpec({ query: methodName, parameters, rowCallback: shim.LAST, opaque: true })
  }

  // segment name does not actually use query string
  // method name is set as query so the query parser has access to the op name
  const parameters = getInstanceAttributeParameters(shim, this)
  return new QuerySpec({
    query: methodName,
    parameters,
    promise: true,
    callback: shim.LAST,
    opaque: true
  })
}

/**
 * Sets up the desc for all instrumented bulk operations
 *
 * @param {Shim} shim instance of shim
 * @returns {object} query spec
 */
common.makeBulkDescFunc = function makeBulkDescFunc(shim) {
  return function bulkDescFunc() {
    const parameters = getInstanceAttributeParameters(shim, this)
    return new QuerySpec({
      query: this.isOrdered ? 'orderedBulk' : 'unorderedBulk',
      parameters,
      promise: true,
      callback: shim.LAST,
      opaque: true
    })
  }
}

/**
 * Sets up a listener for `started` on instrumenter(mongo APM). This applies to
 * mongo <4. The listener adds the following attributes to the active segment:
 * host, port_path_or_id, and database_name
 *
 * @param {Shim} shim instance of shim
 * @param {object} instrumenter instance of mongo APM class
 * @param {object} [options] provide command names to skip updating host/port as they are unrelated to the active query.  This is only in v3 because after every command is runs `endSessions` which runs on the admin database
 */
common.captureAttributesOnStarted = function captureAttributesOnStarted(
  shim,
  instrumenter,
  options = { skipCommands: [] }
) {
  instrumenter.on('started', function onMongoEventStarted(evnt) {
    if (options.skipCommands.includes(evnt.commandName)) {
      return
    }
    // This assumes that this `started` event is fired _after_ our wrapper
    // starts and creates the segment. We perform a check of the segment name
    // out of an excess of caution.
    const connId = evnt.connectionId

    if (connId) {
      // used in v3 when connection is a cluster pool
      if (typeof connId === 'number') {
        setHostPort(shim, evnt.address, evnt.databaseName)
        // used in v3 when connection is to 1 host
      } else if (typeof connId === 'string') {
        setHostPort(shim, connId, evnt.databaseName)
        // v2 remote connection get `host` `port` from respective properties
      } else {
        shim.captureInstanceAttributes(connId.host, connId.port, evnt.databaseName)
      }
    }
  })
}

/**
 * Extracts the host and port from a connection string
 *
 * @param {Shim} shim instance of shim
 * @param {string} connStr mongo connection string
 * @param {string} db database name
 */
function setHostPort(shim, connStr, db) {
  const parts = common.parseAddress(connStr)
  shim.captureInstanceAttributes(parts[0], parts[1], db)
}

/**
 * Get the database_name, host, port_path_or_id
 * for the query segment. v4 refactored where the topology is stored.
 * You can now get the details via the client obj that's deeply nested
 * See: https://github.com/mongodb/node-mongodb-native/pull/2594/files#diff-1d214e57ddda9095d296e5700ebce701333bfefcf417e234c584d14091b2f50dR168
 *
 * @param {Shim} shim instance of shim
 * @param {object} mongo instance of mongo
 * @returns {object} db params
 */
function getInstanceAttributeParameters(shim, mongo) {
  let params
  if (mongo?.s?.topology) {
    shim.logger.trace('Adding datastore instance attributes from mongo.s.db + mongo.s.topology')
    const databaseName = mongo?.s?.db?.databaseName || mongo?.s?.namespace?.db || null
    const topology = mongo.s.topology
    params = getParametersFromTopology(topology, databaseName)
  } else if (mongo?.s?.db?.s?.client?.s?.options?.hosts?.length) {
    const databaseName = mongo?.s?.db?.databaseName || null
    const hosts = mongo.s.db.s.client.s.options.hosts
    params = getParametersFromHosts(hosts, databaseName)
  } else if (mongo?.s?.db?.client?.topology) {
    const databaseName = mongo?.s?.namespace?.db
    const topology = mongo.s.db.client.topology
    params = getParametersFromTopology(topology, databaseName)
  } else {
    shim.logger.trace('Could not find datastore instance attributes.')
    params = new DatastoreParameters()
  }

  return params
}

/**
 * Extracts the database parameters from the first host.
 *
 * @param {Array} hosts mongodb connected hosts
 * @param {string} database name of database
 * @returns {object} db params
 */
function getParametersFromHosts(hosts, database) {
  const [{ host, port }] = hosts

  return new DatastoreParameters({
    host,
    port_path_or_id: port,
    database_name: database
  })
}

/**
 * Extracts the database parameters from the relevant
 * topology configuration
 *
 * @param {object} conf topology configuration
 * @param {string} database name of database
 * @returns {object} db params
 */
function getParametersFromTopology(conf, database) {
  // in older versions of 3.x the host/port
  // lived directly on the topology
  let { host, port } = conf

  // servers is an array but we will always pull the first for consistency
  if (conf?.s?.options?.servers?.length) {
    ;[{ host, port }] = conf.s.options.servers
  }

  // hosts is an array but we will always pull the first for consistency
  if (conf?.s?.options?.hosts?.length) {
    ;[{ host, port }] = conf.s.options.hosts
  }

  return new DatastoreParameters({
    host,
    port_path_or_id: port,
    database_name: database
  })
}

/**
 * Parses mongo address that accounts for IPv6
 *
 * @param {string} address mongo address string
 * @returns {Array} host/port of address string
 */
common.parseAddress = function parseAddress(address) {
  const lastColon = address.lastIndexOf(':')
  const host = address.slice(0, lastColon)
  const port = address.slice(lastColon + 1)
  return [host, port]
}
