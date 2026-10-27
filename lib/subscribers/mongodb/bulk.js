/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbQuerySubscriber = require('#agentlib/subscribers/db-query.js')
const getHostDetails = require('./utils/get-host-details.js')

const {
  MONGODB: MONGODB_METRIC_CONSTANTS
} = require('#agentlib/metrics/names.js')

/**
 * Instruments `BulkOperationBase#execute`. Orchestrion matches the `execute`
 * method directly (see `config.js`), so the segment is created in the handler
 * rather than by wrapping methods on each constructed instance.
 */
module.exports = class BulkSubscriber extends DbQuerySubscriber {
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
    this.isBatch = true
    this.events = ['asyncEnd']
  }

  /**
   * This isn't technically parsing a query, but is returning an object that is
   * used for `ParsedStatement` which at the very least needs `collection` and
   * `operation`.
   *
   * @param {object} bulkOperation The instance of a BulkOperation.
   * @returns {object} The parsed collection and operation.
   */
  parseQuery(bulkOperation) {
    // Older releases of mongodb store the collection on the `s` object.
    // Newer releases have a direct reference available.
    const collection = bulkOperation.collection ?? bulkOperation.s?.collection
    const operation = bulkOperation.isOrdered ? 'orderedBulk' : 'unorderedBulk'

    return { collection: collection?.collectionName, operation }
  }

  /**
   * Assigns the necessary parameters used to record a database query.
   *
   * @param {object} bulkOperation The instance of a BulkOperation.
   */
  setParameters(bulkOperation) {
    const collection = bulkOperation.collection ?? bulkOperation.s?.collection
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
  }

  handler(data, ctx) {
    const bulkOperation = data.self
    this.queryString = bulkOperation
    this.setParameters(bulkOperation)

    return super.handler(data, ctx)
  }
}
