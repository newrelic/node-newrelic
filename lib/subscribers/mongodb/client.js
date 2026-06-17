/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MongoSubscriber = require('./base')
const recordOperationMetrics = require('../../metrics/recorders/database-operation')
const { DB } = require('../../metrics/names')
const { getParameters } = require('./utils')

/**
 * Hooks the `MongoClient` constructor and wraps `connect`.
 *
 * Segment name: `Datastore/operation/MongoDB/connect`
 */
class MongoClientSubscriber extends MongoSubscriber {
  constructor(opts) {
    super(opts)
    this.methods = ['connect']
  }

  buildSegment(operation, mongoObject) {
    const parameters = getParameters(mongoObject, this.system)
    const name = `${DB.OPERATION}/${this.system}/${operation}`
    // recordOperationMetrics reads `this._metrics` (set by DbSubscriber) and
    // derives the operation name from the segment name.
    return { name, recorder: recordOperationMetrics.bind(this), parameters }
  }
}

module.exports = MongoClientSubscriber
