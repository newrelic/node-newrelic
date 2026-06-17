/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MongoSubscriber = require('./base')
const ParsedStatement = require('../../db/parsed-statement')
const recordQueryMetrics = require('../../metrics/recorders/database')
const { DB } = require('../../metrics/names')
const { COLLECTION_OPS } = require('./constants')
const { findCollectionName, getParameters } = require('./utils')

/**
 * Hooks the `Collection` constructor and wraps its document operations
 * (insertOne, findOne, updateMany, aggregate, etc.).
 *
 * Segment name: `Datastore/statement/MongoDB/{collection}/{operation}`
 */
class MongoCollectionSubscriber extends MongoSubscriber {
  constructor(opts) {
    super(opts)
    this.methods = COLLECTION_OPS
  }

  buildSegment(operation, mongoObject) {
    const collection = findCollectionName(mongoObject)
    const parameters = getParameters(mongoObject, this.system)
    // Collection.rename is always routed to the admin database.
    if (operation === 'rename') {
      parameters.database_name = 'admin'
    }
    const parsed = new ParsedStatement(this._metrics.PREFIX, operation, collection, null)
    const name = `${DB.STATEMENT}/${this.system}/${collection}/${operation}`
    return { name, recorder: recordQueryMetrics.bind(parsed), parameters }
  }
}

module.exports = MongoCollectionSubscriber
