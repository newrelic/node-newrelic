/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbSubscriber = require('#agentlib/subscribers/db.js')
const databaseRecorder = require('#agentlib/metrics/recorders/database.js')
const getHostDetails = require('./utils/get-host-details.js')

const {
  DB: DB_METRIC_CONSTANTS,
  MONGODB: MONGODB_METRIC_CONSTANTS
} = require('#agentlib/metrics/names.js')

/**
 * Instruments `BulkOperationBase#execute`. Orchestrion matches the `execute`
 * method directly (see `config.js`), so the segment is created in the handler
 * rather than by wrapping methods on each constructed instance.
 */
module.exports = class BulkSubscriber extends DbSubscriber {
  constructor({ agent, logger }) {
    super({
      agent,
      logger,
      channelName: 'nr_bulk',
      packageName: 'mongodb',
      system: MONGODB_METRIC_CONSTANTS.PREFIX
    })

    // The library invokes its own methods internally while executing the batch;
    // we only want the single overarching segment for the `execute` call.
    this.opaque = true
    // The database metrics recorder reads `this.type` for the database system.
    this.type = this.system
    this.events = ['asyncEnd', 'end']
    this.propagateContext = true
  }

  handler(data, ctx) {
    const bulkOperation = data.self
    // Older releases of mongodb store the collection on the `s` object.
    // Newer releases have a direct reference available.
    const collection = bulkOperation.collection ?? bulkOperation.s?.collection
    const collectionName = collection?.collectionName
    const operation = bulkOperation.isOrdered ? 'orderedBulk' : 'unorderedBulk'

    // Resolve host details when the operation runs. A bulk operation references
    // its `Collection`; resolve host/port through the collection's owning
    // `Db`/`MongoClient`.
    const details = getHostDetails(
      collection?.s?.db ??
      collection?.client ??
      collection ??
      bulkOperation
    )
    this.parameters = {
      host: details.host,
      port_path_or_id: details.port_path_or_id,
      database_name: details.database_name ?? collection?.dbName,
      product: this.system
    }

    return this.createSegment({
      name: `${DB_METRIC_CONSTANTS.STATEMENT}/${this.system}/${collectionName}/${operation}/batch`,
      recorder: function dbRecorder(segment, scope, transaction) {
        return databaseRecorder.call(
          { operation, collection: collectionName, type: this.type },
          segment,
          scope,
          transaction
        )
      }.bind(this),
      ctx
    })
  }
}
