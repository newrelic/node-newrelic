/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { DB, ALL } = require('../names')
const { DESTINATIONS } = require('../../config/attribute-filter')

/**
 * @this ParsedStatement
 * @param {TraceSegment}  segment - The segment being recorded.
 * @param {string}        [scope] - The scope of the segment.
 */

function recordQueryMetrics(segment, scope, transaction) {
  const duration = segment.getDurationInMillis()
  const exclusive = segment.getExclusiveDurationInMillis(transaction.trace)
  const type = transaction.isWeb() ? DB.WEB : DB.OTHER
  const thisTypeSlash = this.type + '/'
  const operation = DB.OPERATION + '/' + thisTypeSlash + this.operation

  // Note, an operation metric should _always_ be created even if the action was
  // a statement. This is part of the spec.

  // Rollups
  transaction.measure(operation, null, duration, exclusive)
  transaction.measure(DB.PREFIX + type, null, duration, exclusive)
  transaction.measure(DB.PREFIX + thisTypeSlash + type, null, duration, exclusive)
  transaction.measure(DB.PREFIX + thisTypeSlash + ALL, null, duration, exclusive)
  transaction.measure(DB.ALL, null, duration, exclusive)

  // If we can parse the SQL statement, create a 'statement' metric, and use it
  // as the scoped metric for transaction breakdowns. Otherwise, skip the
  // 'statement' metric and use the 'operation' metric as the scoped metric for
  // transaction breakdowns.
  let collection
  if (this.collection) {
    collection = DB.STATEMENT + '/' + thisTypeSlash + this.collection + '/' + this.operation
    transaction.measure(collection, null, duration, exclusive)
    if (scope) {
      transaction.measure(collection, scope, duration, exclusive)
    }
  } else if (scope) {
    transaction.measure(operation, scope, duration, exclusive)
  }

  // This recorder is side-effectful Because we are depending on the recorder
  // setting the transaction name, recorders must always be run before generating
  // the final transaction trace
  segment.name = collection || operation

  // Datastore instance metrics.
  const attributes = segment.attributes.get(DESTINATIONS.TRANS_SEGMENT)
  if (attributes.host && attributes.port_path_or_id) {
    const instanceName =
      DB.INSTANCE + '/' + thisTypeSlash + attributes.host + '/' + attributes.port_path_or_id
    transaction.measure(instanceName, null, duration, exclusive)
  }

  if (this.raw) {
    transaction.agent.queries.add({
      segment,
      transaction,
      type: this.type.toLowerCase(),
      query: this.raw,
      trace: this.trace
    })
  }
}

module.exports = recordQueryMetrics
