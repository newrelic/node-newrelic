/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NAMES = require('../../metrics/names')
const recordDistributedTrace = require('./distributed-trace')

const TO_MILLIS = 1e3

function recordWeb(segment, scope, tx) {
  // in web metrics, scope is required
  if (!scope) {
    return
  }

  // if there was a nested webTransaction use its recorder instead
  if (tx.type === 'web' && tx.baseSegment && segment !== tx.baseSegment) {
    return
  }

  const duration = segment.getDurationInMillis()
  const totalTime = tx.trace.getTotalTimeDurationInMillis()
  const exclusive = segment.getExclusiveDurationInMillis(tx.trace)
  const partial = segment.partialName
  const config = tx.agent.config
  // named / key transaction support requires per-name apdexT
  const keyApdexInMillis = config.web_transactions_apdex[scope] * TO_MILLIS || 0

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
    tx.measure(NAMES.CLIENT_APPLICATION + '/' + tx.incomingCatId + '/all', null, tx.catResponseTime)
  }

  tx._setApdex(NAMES.APDEX + '/' + partial, duration, keyApdexInMillis)
  tx._setApdex(NAMES.APDEX, duration, keyApdexInMillis)
}

module.exports = recordWeb
