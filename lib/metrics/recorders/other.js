/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NAMES = require('../../metrics/names')
const recordDistributedTrace = require('./distributed-trace')

function recordBackground(segment, scope) {
  // if there was a nested otherTransaction use its recorder instead
  const tx = segment.transaction
  if (tx.type === 'bg' && tx.baseSegment && segment !== tx.baseSegment) {
    return
  }

  const duration = segment.getDurationInMillis()
  const exclusive = segment.getExclusiveDurationInMillis()
  const totalTime = segment.transaction.trace.getTotalTimeDurationInMillis()
  const name = segment.partialName

  if (scope) {
    tx.measure(scope, null, duration, exclusive)
    tx.measure(NAMES.OTHER_TRANSACTION.TOTAL_TIME + '/' + name, null, totalTime, exclusive)
  }
  // rollup for background total time doesn't have `/all` where the response
  // time version does.
  tx.measure(NAMES.OTHER_TRANSACTION.RESPONSE_TIME + '/all', null, duration, exclusive)
  tx.measure(NAMES.OTHER_TRANSACTION.TOTAL_TIME, null, totalTime, exclusive)

  if (tx.agent.config.distributed_tracing.enabled) {
    recordDistributedTrace(tx, 'Other', duration, exclusive)
  }
}

module.exports = recordBackground
