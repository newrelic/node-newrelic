/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  CURSOR_OPS,
  COLLECTION_OPS,
  DB_OPS
} = require('./constants')
const { URL } = require('url')

const common = module.exports

/**
 * Instruments all methods from constants.CURSOR_OPS on a given
 * cursor class
 *
 * @param {Shim} shim
 * @param {Cursor} Cursor
 */
common.instrumentCursor = function instrumentCursor(shim, Cursor) {
  if (Cursor && Cursor.prototype) {
    const proto = Cursor.prototype
    for (let i = 0; i < CURSOR_OPS.length; i++) {
      shim.recordQuery(proto, CURSOR_OPS[i], common.makeQueryDescFunc(shim, CURSOR_OPS[i]))
    }

    shim.recordQuery(proto, 'each', common.makeQueryDescFunc(shim, 'each'))
    shim.recordOperation(proto, 'pipe')
  }
}

/**
 * Instruments all methods from constants.COLLECTION_OPS on
 * the Collection class
 *
 * @param {Shim} shim
 * @param {Collection} Collection
 */
common.instrumentCollection = function instrumentCollection(shim, Collection) {
  if (Collection && Collection.prototype) {
    const proto = Collection.prototype
    for (let i = 0; i < COLLECTION_OPS.length; i++) {
      shim.recordQuery(
        proto,
        COLLECTION_OPS[i],
        common.makeQueryDescFunc(shim, COLLECTION_OPS[i])
      )
    }
  }
}

/**
 * Instruments all methods from constants.DB_OPS on
 * the Db class.
 *
 * @param {Object} params
 * @param {Shim} params.shim
 * @param {Db} params.Db
 */
common.instrumentDb = function instrumentDb(shim, Db) {
  if (Db && Db.prototype) {
    const proto = Db.prototype
    shim.recordOperation(proto, DB_OPS, {callback: shim.LAST, opaque: true })
    // link to client.connect(removed in v4.0)
    shim.recordOperation(Db, 'connect', {callback: shim.LAST})
  }
}

/**
 * Sets up the desc for all instrumented query methods
 * @param {Shim} shim
 * @param {string} methodName
 */
common.makeQueryDescFunc = function makeQueryDescFunc(shim, methodName) {
  if (methodName === 'each') {
    return function eachDescFunc() {
      const parameters = getInstanceAttributeParameters(shim, this)
      return {query: methodName, parameters, rowCallback: shim.LAST, opaque: true }
    }
  }

  return function queryDescFunc() {
    // segment name does not actually use query string
    // method name is set as query so the query parser has access to the op name
    const parameters = getInstanceAttributeParameters(shim, this)
    return {query: methodName, parameters, promise: true, callback: shim.LAST, opaque: true}
  }
}

/**
 * Sets up a listener for `started` on instrumenter(mongo APM). This applies to
 * mongo <4. The listener adds the following attributes to the active segment:
 * host, port_path_or_id, and database_name
 *
 * @param {Shim} shim
 * @param {Instrumentation} instrumenter instance of mongo APM class
 */
common.captureAttributesOnStarted = function captureAttributesOnStarted(shim, instrumenter) {
  instrumenter.on('started', function onMongoEventStarted(evnt) {
    // This assumes that this `started` event is fired _after_ our wrapper
    // starts and creates the segment. We perform a check of the segment name
    // out of an excess of caution.
    const connId = evnt.connectionId
    if (connId) {
      // Mongo sticks the path to the domain socket in the "host" slot, but we
      // want it in the "port", so if we have a domain socket we need to change
      // the order of our parameters.
      if (typeof connId === 'string') {
        const parts = connId.split(':')
        if (parts.length && parts[0][0] === '/') {
          shim.captureInstanceAttributes('localhost', parts[0], evnt.databaseName)
        } else {
          shim.captureInstanceAttributes(parts[0], parts[1], evnt.databaseName)
        }
      } else if (connId.domainSocket) {
        shim.captureInstanceAttributes('localhost', connId.host, evnt.databaseName)
      } else {
        shim.captureInstanceAttributes(connId.host, connId.port, evnt.databaseName)
      }
    }
  })
}

/**
 * Get the database_name, host, port_path_or_id
 * for the query segment. v4 refactored where the toplogy is stored.
 * You can now get the details via the client obj that's deeply nested
 * See: https://github.com/mongodb/node-mongodb-native/pull/2594/files#diff-1d214e57ddda9095d296e5700ebce701333bfefcf417e234c584d14091b2f50dR168
 */
function getInstanceAttributeParameters(shim, obj) {
  if (obj.s && obj.s.db && obj.s.topology) {
    shim.logger.trace(
      'Adding datastore instance attributes from obj.s.db + obj.s.topology'
    )
    const databaseName = obj.s.db.databaseName || null
    const topology = obj.s.topology
    if (topology.s && topology.s.options) {
      return doCapture(topology.s.options, databaseName)
    }
  } else if (obj.s && obj.s.db && obj.s.db.s && obj.s.db.s.client &&
    obj.s.db.s.client.s && obj.s.db.s.client.s.url) {
    let { hostname: host, port: port_path_or_id } = new URL(obj.s.db.s.client.s.url)
    if (host.endsWith('.sock')) {
      // socket path is uri encoded
      // decode it to properly name attrs
      port_path_or_id = decodeURIComponent(host)
      host = 'localhost'
    }
    return {
      host,
      port_path_or_id,
      database_name: obj.s.db.databaseName
    }
  }

  shim.logger.trace('Could not find datastore instance attributes.')
  return {
    host: null,
    port_path_or_id: null,
    database_name: null
  }

  function doCapture(conf, database) {
    let host = conf.host
    let port = conf.port

    // If using a domain socket, mongo stores the path as the host name, but we
    // pass it through the port value.
    if (
      (conf.socketOptions && conf.socketOptions.domainSocket) ||
      /\.sock$/.test(host)
    ) {
      port = host
      host = 'localhost'
    }

    return {
      host: host,
      port_path_or_id: port,
      database_name: database
    }
  }
}
