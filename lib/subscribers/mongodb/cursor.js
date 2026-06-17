/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MongoSubscriber = require('./base')
const ParsedStatement = require('../../db/parsed-statement')
const recordQueryMetrics = require('../../metrics/recorders/database')
const { DB } = require('../../metrics/names')
const { CURSOR_OPS } = require('./constants')
const { findCollectionName, getParameters } = require('./utils')

/**
 * Hooks the `AbstractCursor` constructor and wraps cursor operations
 * (next, toArray, forEach, count, explain, etc.). Subclasses such as
 * `FindCursor` and `AggregationCursor` trigger the same constructor hook via
 * `super()`, and `count`/`explain` (which live on those subclasses) are wrapped
 * on their owning prototype by walking the prototype chain.
 *
 * Segment name: `Datastore/statement/MongoDB/{collection}/{operation}`
 */
class MongoCursorSubscriber extends MongoSubscriber {
  constructor(opts) {
    super(opts)
    this.methods = CURSOR_OPS
  }

  buildSegment(operation, mongoObject) {
    const collection = findCollectionName(mongoObject)
    const parameters = getParameters(mongoObject, this.system)
    const parsed = new ParsedStatement(this._metrics.PREFIX, operation, collection, null)
    const name = `${DB.STATEMENT}/${this.system}/${collection}/${operation}`
    return { name, recorder: recordQueryMetrics.bind(parsed), parameters }
  }
}

module.exports = MongoCursorSubscriber
