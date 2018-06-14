'use strict'

var EXTERNAL = require('../../metrics/names').EXTERNAL


function recordExternal(host, library) {
  return function externalRecorder(segment, scope) {
    var duration = segment.getDurationInMillis()
    var exclusive = segment.getExclusiveDurationInMillis()
    var transaction = segment.transaction
    var metricName = EXTERNAL.PREFIX + host + '/' + library
    var rollupType = transaction.isWeb() ? EXTERNAL.WEB : EXTERNAL.OTHER
    var rollupHost = EXTERNAL.PREFIX + host + '/all'

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
          EXTERNAL.TRANSACTION + host + '/' + segment.catId +
            '/' + segment.catTransaction,
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
