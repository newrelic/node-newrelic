/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const MongoSubscriber = require('./base')
const ParsedStatement = require('../../db/parsed-statement')
const recordQueryMetrics = require('../../metrics/recorders/database')
const { DB } = require('../../metrics/names')
const { getParameters } = require('./utils')

/**
 * Hooks the `BulkOperationBase` constructor and wraps `execute`. The concrete
 * `OrderedBulkOperation`/`UnorderedBulkOperation` subclasses trigger the same
 * constructor hook via `super()`.
 *
 * Segment name: `Datastore/statement/MongoDB/{collection}/{orderedBulk|unorderedBulk}/batch`
 */
class MongoBulkSubscriber extends MongoSubscriber {
  constructor(opts) {
    super(opts)
    this.methods = ['execute']
  }

  buildSegment(operation, bulk) {
    const collection = bulk?.collection ?? bulk?.s?.collection ?? null
    const collectionName = collection?.collectionName ?? 'unknown'
    const op = bulk?.isOrdered ? 'orderedBulk' : 'unorderedBulk'
    const parameters = getParameters(collection, this.system)

    const parsed = new ParsedStatement(this._metrics.PREFIX, op, collectionName, null)
    const name = `${DB.STATEMENT}/${this.system}/${collectionName}/${op}/batch`
    return { name, recorder: recordQueryMetrics.bind(parsed), parameters }
  }
}

module.exports = MongoBulkSubscriber
