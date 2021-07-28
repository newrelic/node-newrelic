/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  instrumentCollection,
  instrumentCursor,
  instrumentDb
} = require('./common')
function queryParser(operation) {
  let collection = this.collectionName || 'unknown'

  // cursor methods have collection on namespace.collection
  if (this.namespace && this.namespace.collection) {
    collection = this.namespace.collection
  }

  return {operation, collection}
}

/**
 * `commandStarted` handler used to
 * update host, port and database_name
 * on segment attributes
 *
 * @param {Shim} shim
 * @param {CommandStartedEvent} evnt
 */
function cmdStartedHandler(shim, evnt) {
  if (evnt.connectionId) {
    const [addr,port] = evnt.address.split(':')
    let host = addr
    if (addr === '127.0.0.1') {
      host = 'localhost'
    }
    shim.captureInstanceAttributes(host, port, evnt.databaseName)
  }
}

/**
 * function executed when client.connect is called to add
 * `commandStarted` listener
 *
 * @param {Shim} shim
 */
function wrapConnect(shim) {
  this.on('commandStarted', cmdStartedHandler.bind(this, shim))
  return { callback: shim.LAST }
}

/**
 * Wraps connect to record as operation but also to add a listener
 * for `commandStarted`.  This will be emitted before every command starts
 * so we can properly update the segment attributes with a more accurate
 * host/port/database name
 *
 * @param {Shim} shim
 * @param {MongoClient} MongoClient reference
 */
function instrumentMongoClient(shim, MongoClient) {
  shim.recordOperation(MongoClient.prototype, 'connect', wrapConnect)
}


module.exports = function instrument(shim, mongodb) {
  shim.setParser(queryParser)
  instrumentMongoClient(shim, mongodb.MongoClient)
  instrumentCursor(shim, mongodb.AbstractCursor)
  instrumentCursor(shim, mongodb.FindCursor)
  instrumentCursor(shim, mongodb.AggregationCursor)
  instrumentCollection(shim, mongodb.Collection)

  /**
   * setting opaque to `true`
   * because v4.0 has several net.* events after command
   * because it acquires connections in pool and we want to
   * obfuscate these things
   */
  instrumentDb({ shim, Db: mongodb.Db, opaque: true })
}
