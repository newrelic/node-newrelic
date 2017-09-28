'use strict'

var NAMES = require('../../metrics/names.js')

function recordMessageTransaction(segment, scope) {
  var tx = segment.transaction
  if (tx.type !== 'message' || tx.baseSegment !== segment) {
    return
  }

  var duration = segment.getDurationInMillis()
  var exclusive = segment.getExclusiveDurationInMillis()
  var totalTime = segment.transaction.trace.getTotalTimeDurationInMillis()

  var tx = segment.transaction
  if (scope) {
    tx.measure(scope, null, duration, exclusive)
    tx.measure(
      NAMES.MESSAGE_TRANSACTION.TOTAL_TIME + '/' + tx.getName(),
      null,
      totalTime,
      exclusive
    )
  }

  tx.measure(
    NAMES.MESSAGE_TRANSACTION.RESPONSE_TIME + '/all',
    null,
    duration,
    exclusive
  )
  tx.measure(
    NAMES.OTHER_TRANSACTION.RESPONSE_TIME + '/all',
    null,
    duration,
    exclusive
  )
  tx.measure(NAMES.OTHER_TRANSACTION.TOTAL_TIME, null, totalTime, exclusive)
}

module.exports = recordMessageTransaction
