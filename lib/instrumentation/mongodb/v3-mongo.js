/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  captureAttributesOnStarted,
  instrumentBulkOperation,
  instrumentCollection,
  instrumentCursor,
  instrumentDb,
  NR_ATTRS
} = require('./common')

/**
 * parser used to grab the collection and operation
 * on every mongo operation
 *
 * @param {object} operation
 */
function queryParser(operation) {
  let collection = this.collectionName || 'unknown'
  // in v3.3.0 aggregate commands added the collection
  // to target
  if (this.operation && this.operation.target) {
    collection = this.operation.target
  } else if (this.ns) {
    collection = this.ns.split(/\./)[1] || collection
  } else if (this.s && this.s.collection && this.s.collection.collectionName) {
    collection = this.s.collection.collectionName
  }
  return { operation, collection }
}

/**
 * Records the `mongo.MongoClient.connect` operations. It also adds the first arg of connect(url)
 * to a Symbol on the MongoClient to be used later to extract the host/port in cases where the topology
 * is a cluster of domain sockets
 *
 * @param {Shim} shim
 * @param {object} mongodb resolved package
 */
function instrumentClient(shim, mongodb) {
  shim.recordOperation(mongodb.MongoClient, 'connect', function wrappedConnect(shim, _, __, args) {
    // Add the connection url to the MongoClient to retrieve later in the `lib/instrumentation/mongo/common`
    // captureAttributesOnStarted listener
    this[NR_ATTRS] = args[0]
    return { callback: shim.LAST }
  })
}

/**
 * Registers relevant instrumentation for mongo >= 3.0.6
 * In 3.0.6 they refactored their "APM" module which removed
 * a lot of niceities around instrumentation classes.
 * see: https://github.com/mongodb/node-mongodb-native/pull/1675/files
 * This reverts back to instrumenting pre-canned methods on classes
 * as well as sets up a listener for when commands start to properly
 * add necessary attributes to segments
 *
 * @param {Shim} shim
 * @param {object} mongodb resolved package
 */
module.exports = function instrument(shim, mongodb) {
  shim.setParser(queryParser)
  instrumentClient(shim, mongodb)
  const instrumenter = mongodb.instrument(Object.create(null), () => {})
  // in v3 of mongo endSessions fires after every command and it updates the active segment
  // attributes with the admin database name which stomps on the database name where the original
  // command runs on
  captureAttributesOnStarted(shim, instrumenter, { skipCommands: ['endSessions'] })
  instrumentCursor(shim, mongodb.Cursor)
  instrumentCursor(shim, shim.require('./lib/aggregation_cursor'))
  instrumentCursor(shim, shim.require('./lib/command_cursor'))
  instrumentBulkOperation(shim, shim.require('./lib/bulk/common'))
  instrumentCollection(shim, mongodb.Collection)
  instrumentDb(shim, mongodb.Db)

  // calling instrument sets up listeners for a few events
  // we should restore this on unload to avoid leaking
  // event emitters
  shim.agent.once('unload', function uninstrumentMongo() {
    instrumenter.uninstrument()
  })
}
