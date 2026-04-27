/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const EXTERNAL = require('../../metrics/names').EXTERNAL

function recordExternal(host, library) {
  return function externalRecorder(segment, scope, transaction) {
    const duration = segment.getDurationInMillis()
    const exclusive = segment.getExclusiveDurationInMillis(transaction.trace)
    const metricName = EXTERNAL.PREFIX + host + '/' + library
    const rollupType = transaction.isWeb() ? EXTERNAL.WEB : EXTERNAL.OTHER
    const rollupHost = EXTERNAL.PREFIX + host + '/all'

    if (scope) {
      transaction.measure(metricName, scope, duration, exclusive)
    }

    transaction.measure(metricName, null, duration, exclusive)
    transaction.measure(rollupType, null, duration, exclusive)
    transaction.measure(rollupHost, null, duration, exclusive)
    transaction.measure(EXTERNAL.ALL, null, duration, exclusive)
  }
}

module.exports = recordExternal
