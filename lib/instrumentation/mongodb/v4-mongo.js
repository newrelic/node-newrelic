/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { OperationSpec } = require('../../shim/specs')
const {
  instrumentBulkOperation,
  instrumentCollection,
  instrumentCursor,
  instrumentDb,
  parseAddress
} = require('./common')
const queryParser = require('../../db/query-parsers/mongodb')

/**
 * `commandStarted` handler used to
 * update host, port and database_name
 * on segment attributes
 *
 * @param {Shim} shim instance of shim
 * @param {CommandStartedEvent} evnt mongodb event
 */
function cmdStartedHandler(shim, evnt) {
  if (evnt.connectionId) {
    const address = parseAddress(evnt.address)
    let [host] = address
    const [, port] = address
    if (['127.0.0.1', '::1', '[::1]'].includes(host)) {
      host = 'localhost'
    }

    shim.captureInstanceAttributes(host, port, evnt.databaseName)
  }
}

/**
 * function executed when client.connect is called
 * enable APM(monitorCommands) and add the
 * `commandStarted` listener
 *
 * @param {Shim} shim instance of shim
 * @returns {OperationSpec} spec to capture connect method
 */
function wrapConnect(shim) {
  this.monitorCommands = true
  this.on('commandStarted', cmdStartedHandler.bind(this, shim))
  return new OperationSpec({ callback: shim.LAST, name: 'connect' })
}

/**
 * Wraps connect to record as operation but also to add a listener
 * for `commandStarted`.  This will be emitted before every command starts
 * so we can properly update the segment attributes with a more accurate
 * host/port/database name
 *
 * @param {Shim} shim instance of shim
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
  instrumentDb(shim, mongodb.Db)
  instrumentBulkOperation(shim, shim.require('./lib/bulk/common'))
}
