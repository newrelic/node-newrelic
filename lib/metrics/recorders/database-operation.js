/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const metrics = require('../names')

/**
 * Records all the metrics required for database operations.
 *
 * - `recordOperationMetrics(segment [, scope])`
 *
 * @private
 * @this DatastoreShim
 * @implements {MetricFunction}
 * @param {TraceSegment}  segment - The segment being recorded.
 * @param {string}        [scope] - The scope of the segment.
 * @see DatastoreShim#recordOperation
 * @see MetricFunction
 */
function recordOperationMetrics(segment, scope, transaction) {
  const duration = segment.getDurationInMillis()
  const exclusive = segment.getExclusiveDurationInMillis(transaction.trace)
  const type = transaction.isWeb() ? 'allWeb' : 'allOther'
  const operation = segment.name

  if (scope) {
    transaction.measure(operation, scope, duration, exclusive)
  }

  transaction.measure(operation, null, duration, exclusive)
  transaction.measure(metrics.DB.PREFIX + type, null, duration, exclusive)
  transaction.measure(metrics.DB.ALL, null, duration, exclusive)
  transaction.measure(this._metrics.ALL, null, duration, exclusive)
  transaction.measure(
    metrics.DB.PREFIX + this._metrics.PREFIX + '/' + type,
    null,
    duration,
    exclusive
  )

  const attributes = segment.getAttributes()
  if (attributes.host && attributes.port_path_or_id) {
    const instanceName = [
      metrics.DB.INSTANCE,
      this._metrics.PREFIX,
      attributes.host,
      attributes.port_path_or_id
    ].join('/')

    transaction.measure(instanceName, null, duration, exclusive)
  }
}

module.exports = recordOperationMetrics
