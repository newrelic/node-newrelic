/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbQuerySubscriber = require('../db-query')
const { MONGODB } = require('../../metrics/names')
const { getParameters, bulkCollection } = require('./utils')

/**
 * Subscriber for `BulkOperationBase.execute()`.
 *
 * Segment name: `Datastore/statement/MongoDB/{collection}/{orderedBulk|unorderedBulk}/batch`
 */
class MongoBulkSubscriber extends DbQuerySubscriber {
  constructor({ agent, logger, channelName, packageName = 'mongodb' }) {
    super({ agent, logger, channelName, packageName, system: MONGODB.PREFIX })
    this.events = ['asyncEnd']
    this.isBatch = true
  }

  handler(data, ctx) {
    const bulk = data.self

    this.queryString = bulk?.isOrdered ? 'orderedBulk' : 'unorderedBulk'
    this._bulk = bulk
    this.parameters = getParameters(bulk, this.system)

    return super.handler(data, ctx)
  }

  parseQuery(queryString) {
    const coll = bulkCollection(this._bulk)
    return {
      operation: queryString,
      collection: coll?.collectionName ?? 'unknown',
      query: null
    }
  }
}

module.exports = MongoBulkSubscriber
