'use strict'

const NAMES = require('../../metrics/names')
const recordDistributedTrace = require('./distributed-trace')

function recordBackground(segment, scope) {
  // if there was a nested otherTransaction use its recorder instead
  var tx = segment.transaction
  if (tx.type === 'bg' && tx.baseSegment && segment !== tx.baseSegment) {
    return
  }

  var duration = segment.getDurationInMillis()
  var exclusive = segment.getExclusiveDurationInMillis()
  var totalTime = segment.transaction.trace.getTotalTimeDurationInMillis()
  var name = segment.partialName

  if (scope) {
    tx.measure(scope, null, duration, exclusive)
    tx.measure(
      NAMES.OTHER_TRANSACTION.TOTAL_TIME + '/' + name,
      null,
      totalTime,
      exclusive
    )
  }
  // rollup for background total time doesn't have `/all` where the response
  // time version does.
  tx.measure(
    NAMES.OTHER_TRANSACTION.RESPONSE_TIME + '/all',
    null,
    duration,
    exclusive
  )
  tx.measure(NAMES.OTHER_TRANSACTION.TOTAL_TIME, null, totalTime, exclusive)

  if (tx.agent.config.feature_flag.distributed_tracing) {
    recordDistributedTrace(tx, 'Other', duration, exclusive)
  }
}

module.exports = recordBackground
