'use strict'

const NAMES = require('../../metrics/names')
const recordDistributedTrace = require('./distributed-trace')

const TO_MILLIS = 1e3

function recordWeb(segment, scope) {
  // in web metrics, scope is required
  if (!scope) return

  var tx = segment.transaction
  // if there was a nested webTransaction use its recorder instead
  if (tx.type === 'web' && tx.baseSegment && segment !== tx.baseSegment) {
    return
  }

  var duration = segment.getDurationInMillis()
  var totalTime = tx.trace.getTotalTimeDurationInMillis()
  var exclusive = segment.getExclusiveDurationInMillis()
  var partial = segment.partialName
  var config = segment.transaction.agent.config
  // named / key transaction support requires per-name apdexT
  var keyApdexInMillis = config.web_transactions_apdex[scope] * TO_MILLIS || 0

  tx.measure(NAMES.WEB.RESPONSE_TIME, null, duration, exclusive)
  tx.measure(NAMES.WEB.TOTAL_TIME, null, totalTime, exclusive)
  tx.measure(NAMES.HTTP, null, duration, exclusive)
  tx.measure(scope, null, duration, exclusive)
  tx.measure(NAMES.WEB.TOTAL_TIME + '/' + partial, null, totalTime, exclusive)

  if (tx.queueTime > 0) {
    tx.measure(NAMES.QUEUETIME, null, tx.queueTime)
  }

  if (config.distributed_tracing.enabled) {
    recordDistributedTrace(tx, 'Web', duration, exclusive)
  } else if (tx.incomingCatId) {
    tx.measure(
        NAMES.CLIENT_APPLICATION + '/' + tx.incomingCatId + "/all",
        null,
        tx.catResponseTime
      )
  }

  tx._setApdex(NAMES.APDEX + '/' + partial, duration, keyApdexInMillis)
  tx._setApdex(NAMES.APDEX, duration, keyApdexInMillis)
}

module.exports = recordWeb
