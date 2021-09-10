/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const EXTERNAL = require('../../metrics/names').EXTERNAL

function recordExternal(host, library) {
  return function externalRecorder(segment, scope) {
    const duration = segment.getDurationInMillis()
    const exclusive = segment.getExclusiveDurationInMillis()
    const transaction = segment.transaction
    const metricName = EXTERNAL.PREFIX + host + '/' + library
    const rollupType = transaction.isWeb() ? EXTERNAL.WEB : EXTERNAL.OTHER
    const rollupHost = EXTERNAL.PREFIX + host + '/all'

    if (segment.catId && segment.catTransaction) {
      transaction.measure(
        EXTERNAL.APP + host + '/' + segment.catId + '/all',
        null,
        duration,
        exclusive
      )

      transaction.measure(
        EXTERNAL.TRANSACTION + host + '/' + segment.catId + '/' + segment.catTransaction,
        null,
        duration,
        exclusive
      )

      // This CAT metric replaces scoped External/{host}/{method}
      if (scope) {
        transaction.measure(
          EXTERNAL.TRANSACTION + host + '/' + segment.catId + '/' + segment.catTransaction,
          scope,
          duration,
          exclusive
        )
      }
    } else if (scope) {
      transaction.measure(metricName, scope, duration, exclusive)
    }

    transaction.measure(metricName, null, duration, exclusive)
    transaction.measure(rollupType, null, duration, exclusive)
    transaction.measure(rollupHost, null, duration, exclusive)
    transaction.measure(EXTERNAL.ALL, null, duration, exclusive)
  }
}

module.exports = recordExternal
