/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbSubscriber = require('../db.js')
const databaseRecorder = require('#agentlib/metrics/recorders/database.js')
const getHostDetails = require('./utils/get-host-details.js')

const {
  DB: DB_METRIC_CONSTANTS,
  MONGODB: MONGODB_METRIC_CONSTANTS
} = require('#agentlib/metrics/names.js')

const ADMIN_COMMANDS = require('./utils/admin-commands.js')

/**
 * This list is a list of all methods we are interested in instrumenting,
 * regardless of client version. As we iterate through the list we will perform
 * a presence check for each method.
 *
 * @type {string[]}
 */
const CURSOR_METHODS = [
  'aggregate',
  'bulkWrite',
  'count',
  'createIndex',
  'deleteMany',
  'deleteOne',
  'distinct',
  'drop',
  'dropAllIndexes',
  'dropIndex',
  'ensureIndex',
  'findAndModify',
  'findAndRemove',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'geoHaystackSearch',
  'geoNear',
  'group',
  'indexExists',
  'indexInformation',
  'indexes',
  'insert',
  'insertMany',
  'insertOne',
  'isCapped',
  'mapReduce',
  'options',
  'parallelCollectionScan',
  'reIndex',
  'remove',
  'rename',
  'replaceOne',
  'save',
  'stats',
  'update',
  'updateMany',
  'updateOne'
]

module.exports = class CollectionSubscriber extends DbSubscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      channelName: 'nr_collection',
      packageName: 'mongodb',
      system: MONGODB_METRIC_CONSTANTS.PREFIX
    })

    this.events = ['end']
    // We set `opaque` to true because the library uses its own methods
    // internally, and we only care about the entry point. That is, if the
    // code is `.findOne('something')`, the  method will invoke `.next`
    // internally. We don't care to track `.next` with its own reported segment.
    // We only want to record the overall operation of `.findOne`.
    this.opaque = true

    // The database metrics recorder reads `this.type` to get the name of the
    // database system.
    this.type = this.system
  }

  end(data, ctx) {
    const { self: dbClient, arguments: args } = data
    const [dbInstance, collectionName] = args
    const details = getHostDetails(dbInstance)
    this.parameters = {
      host: details.host,
      port_path_or_id: details.port_path_or_id,
      database_name: details.database_name,
      product: this.system
    }

    for (const method of CURSOR_METHODS) {
      if (typeof dbClient[method] !== 'function') {
        continue
      }

      this.#wrapMethod(dbClient, method, collectionName)
    }

    return ctx
  }

  parseQueryString() {

  }

  #wrapMethod(instance, methodName, collection) {
    const self = this
    const orig = instance[methodName]

    instance[methodName] = function nrWrappedMethod(...args) {
      let ctx = self.agent.tracer.getContext()
      if (ctx.transaction == null || ctx.transaction.isActive() === false) {
        self.logger.debug(
          'Not recording function %s, not in a transaction',
          methodName
        )
        return orig.apply(instance, args)
      }

      self.logger.debug('Recording function %s', methodName)

      // The metrics recorder records the "operation" and "collection"
      // attributes. `operation` is the operation being performed; in a DBMS
      // this would be `select` or `delete`, but in Mongo it's the method name.
      // `collection` is the target data space, e.g. `schema.table_name` in
      // a DBMS. In Mongo, it is the document namespace.
      //
      // We have to capture these values in a closure scope because multiple
      // cursor methods may fire in one transaction. For example, when using
      // the `.toArray` method the `.next` method will be invoked at least once
      // to get the documents to add to the resulting array. If we stored this
      // information on our object instance, the values would get overwritten
      // by the nested operations.
      const capturedOperation = methodName
      const capturedCollection = collection

      const segmentAttributes = {}
      if (ADMIN_COMMANDS.includes(methodName) === true) {
        segmentAttributes.database_name = 'admin'
      }

      ctx = self.createSegment({
        name: `${DB_METRIC_CONSTANTS.STATEMENT}/${self.system}/${collection}/${methodName}`,
        recorder: function cursorRecorder(segment, scope, transaction) {
          const recorderContext = {
            operation: capturedOperation,
            collection: capturedCollection,
            type: self.type
          }
          return databaseRecorder.call(recorderContext, segment, scope, transaction)
        },
        attributes: segmentAttributes,
        ctx
      })
      return self.agent.tracer.runInContext({
        handler: orig,
        context: ctx,
        full: true,
        thisArg: instance,
        args
      })
    }
  }
}
