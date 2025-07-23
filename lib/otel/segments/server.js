/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Transaction = require('../../transaction')
const httpRecorder = require('../../metrics/recorders/http')
const { propagateTraceContext } = require('./utils')
const createInternalSegment = require('./internal')

module.exports = function createServerSegment(agent, otelSpan, rule) {
  const activeTx = agent.tracer.getTransaction()
  // tx already exists do not create a new transaction
  if (activeTx) {
    rule.txTransformation = {}
    return createInternalSegment(agent, otelSpan, rule)
  }
  const spanContext = otelSpan.spanContext()
  const transaction = new Transaction(agent, spanContext?.traceId)
  propagateTraceContext({ transaction, otelSpan, transport: 'HTTPS' })
  const segment = agent.tracer.createSegment({
    id: otelSpan?.spanContext()?.spanId,
    recorder: httpRecorder,
    name: otelSpan.name,
    parent: transaction.trace.root,
    transaction
  })
  transaction.baseSegment = segment
  return { segment, transaction, rule }
}
