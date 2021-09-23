/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { DB, ALL } = require('../metrics/names')
const { DESTINATIONS } = require('../config/attribute-filter')

function ParsedStatement(type, operation, collection, raw) {
  this.type = type
  this.operation = operation
  this.collection = collection
  this.trace = null
  this.raw = ''

  if (typeof raw === 'string') {
    this.trace = new Error().stack
    this.raw = raw
  }
}

ParsedStatement.prototype.recordMetrics = function recordMetrics(segment, scope) {
  const duration = segment.getDurationInMillis()
  const exclusive = segment.getExclusiveDurationInMillis()
  const transaction = segment.transaction
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
    transaction.agent.queries.add(segment, this.type.toLowerCase(), this.raw, this.trace)
  }
}

module.exports = ParsedStatement
