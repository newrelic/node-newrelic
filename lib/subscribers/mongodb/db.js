/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MongoSubscriber = require('./base')
const recordOperationMetrics = require('../../metrics/recorders/database-operation')
const { DB } = require('../../metrics/names')
const { DB_OPS } = require('./constants')
const { getParameters } = require('./utils')

/**
 * Hooks the `Db` constructor and wraps its operations (command,
 * createCollection, dropDatabase, renameCollection, collection, etc.).
 *
 * Segment name: `Datastore/operation/MongoDB/{operation}`
 */
class MongoDbSubscriber extends MongoSubscriber {
  constructor(opts) {
    super(opts)
    this.methods = DB_OPS
  }

  buildSegment(operation, mongoObject) {
    const parameters = getParameters(mongoObject, this.system)
    // Db.renameCollection is always routed to the admin database.
    if (operation === 'renameCollection') {
      parameters.database_name = 'admin'
    }
    const name = `${DB.OPERATION}/${this.system}/${operation}`
    // recordOperationMetrics reads `this._metrics` (set by DbSubscriber) and
    // derives the operation name from the segment name.
    return { name, recorder: recordOperationMetrics.bind(this), parameters }
  }
}

module.exports = MongoDbSubscriber
