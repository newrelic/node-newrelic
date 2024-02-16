/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { CURSOR_OPS, COLLECTION_OPS, DB_OPS } = require('./constants')
const common = module.exports
common.NR_ATTRS = Symbol('NR_ATTRS')

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
    for (let i = 0; i < CURSOR_OPS.length; i++) {
      shim.recordQuery(proto, CURSOR_OPS[i], common.makeQueryDescFunc(shim, CURSOR_OPS[i]))
    }

    shim.recordQuery(proto, 'each', common.makeQueryDescFunc(shim, 'each'))
    shim.recordOperation(proto, 'pipe', { opaque: true })
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
    for (let i = 0; i < COLLECTION_OPS.length; i++) {
      shim.recordQuery(proto, COLLECTION_OPS[i], common.makeQueryDescFunc(shim, COLLECTION_OPS[i]))
    }
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
    shim.recordOperation(proto, DB_OPS, { callback: shim.LAST, opaque: true })
    // link to client.connect(removed in v4.0)
    shim.recordOperation(Db, 'connect', { callback: shim.LAST })
  }
}

/**
 * Sets up the desc for all instrumented query methods
 *
 * @param {Shim} shim instance of shim
 * @param {string} methodName name of method getting executed
 * @returns {object} query spec
 */
common.makeQueryDescFunc = function makeQueryDescFunc(shim, methodName) {
  if (methodName === 'each') {
    return function eachDescFunc() {
      const parameters = getInstanceAttributeParameters(shim, this)
      return { query: methodName, parameters, rowCallback: shim.LAST, opaque: true }
    }
  }

  return function queryDescFunc() {
    // segment name does not actually use query string
    // method name is set as query so the query parser has access to the op name
    const parameters = getInstanceAttributeParameters(shim, this)
    return { query: methodName, parameters, promise: true, callback: shim.LAST, opaque: true }
  }
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
    return {
      query: this.isOrdered ? 'orderedBulk' : 'unorderedBulk',
      parameters,
      promise: true,
      callback: shim.LAST,
      opaque: true
    }
  }
}

/**
 * Sets up a listener for `started` on instrumenter(mongo APM). This applies to
 * mongo <4. The listener adds the following attributes to the active segment:
 * host, port_path_or_id, and database_name
 *
 * @param {Shim} shim instance of shim
 * @param {object} instrumenter instance of mongo APM class
 * @param {object} [options={}] provide command names to skip updating host/port as they are unrelated to the active query.  This is only in v3 because after every command is runs `endSessions` which runs on the admin database
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
        setHostPort(shim, evnt.address, evnt.databaseName, this.$MongoClient)
        // used in v3 when connection is to 1 host
      } else if (typeof connId === 'string') {
        setHostPort(shim, connId, evnt.databaseName)
        // v2 contains `domainSocket`, get socket connection from `host`
      } else if (connId.domainSocket) {
        shim.captureInstanceAttributes('localhost', connId.host, evnt.databaseName)
        // v2 remote connection get `host` `port` from respective properties
      } else {
        shim.captureInstanceAttributes(connId.host, connId.port, evnt.databaseName)
      }
    }
  })
}

/**
 * Extracts the host and port from a connection string
 * This also handles if connection string is a domain socket
 * Mongo sticks the path to the domain socket in the "host" slot, but we
 * want it in the "port", so if we have a domain socket we need to change
 * the order of our parameters.
 *
 * @param {Shim} shim instance of shim
 * @param {string} connStr mongo connection string
 * @param {string} db database name
 * @param {object} client mongo client instance
 */
function setHostPort(shim, connStr, db, client) {
  const parts = common.parseAddress(connStr)
  // in v3 when running with a cluster of socket connections
  // the address is `undefined:undefined`. we will instead attempt
  // to get connection details from the client symbol NR_ATTRS
  // added in `lib/instrumentation/mongodb/v3-mongo` when a client connects
  // with a URL string
  if (parts.includes('undefined')) {
    try {
      const attrs = client[common.NR_ATTRS]
      const socket = decodeURIComponent(attrs.split(',')[0].split('mongodb://')[1])
      shim.captureInstanceAttributes('localhost', socket, db)
    } catch (err) {
      shim.logger.debug(err, 'Could not extract host/port from mongo command')
    }
    // connected using domain socket but the "host"(e.g: /path/to/mongo-socket-port.sock)
  } else if (parts.length && parts[0][0] === '/') {
    shim.captureInstanceAttributes('localhost', parts[0], db)
  } else {
    shim.captureInstanceAttributes(parts[0], parts[1], db)
  }
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
  let params = {
    host: null,
    port_path_or_id: null,
    database_name: null
  }

  if (mongo?.s?.topology) {
    shim.logger.trace('Adding datastore instance attributes from mongo.s.db + mongo.s.topology')
    const databaseName = mongo?.s?.db?.databaseName || mongo?.s?.namespace?.db || null
    const topology = mongo.s.topology
    params = getParametersFromTopology(topology, databaseName)
  } else if (mongo?.s?.db?.s?.client?.s?.options?.hosts?.length) {
    const databaseName = mongo?.s?.db?.databaseName || null
    const hosts = mongo.s.db.s.client.s.options.hosts
    params = getParametersFromHosts(hosts, databaseName)
  } else {
    shim.logger.trace('Could not find datastore instance attributes.')
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
  let [{ host, port }] = hosts
  const [{ socketPath }] = hosts

  if (socketPath) {
    port = socketPath
    host = 'localhost'
  }
  return {
    host,
    port_path_or_id: port,
    database_name: database
  }
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

  // host is a domain socket. set host as localhost and use the domain
  // socket host as the port
  if (host && host.endsWith('.sock')) {
    port = host
    host = 'localhost'
  }

  return {
    host: host,
    port_path_or_id: port,
    database_name: database
  }
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
