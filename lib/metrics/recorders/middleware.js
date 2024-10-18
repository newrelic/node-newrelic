/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Creates a recorder for middleware metrics.
 *
 * @private
 * @param {object} _shim instance of shim
 * @param {string} metricName name of metric
 * @returns {Function} recorder for middleware
 */
function makeMiddlewareRecorder(_shim, metricName) {
  return function middlewareMetricRecorder(segment, scope) {
    const duration = segment.getDurationInMillis()
    const exclusive = segment.getExclusiveDurationInMillis()
    const transaction = segment.transaction

    if (scope) {
      transaction.measure(metricName, scope, duration, exclusive)
    }
    transaction.measure(metricName, null, duration, exclusive)
  }
}

module.exports = makeMiddlewareRecorder
