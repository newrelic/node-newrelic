/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = createConsumerSegment

const Transaction = require('../../transaction/')
const recorder = require('../../metrics/recorders/message-transaction')
const { propagateTraceContext } = require('./utils')
const createInternalSegment = require('./internal')

function createConsumerSegment(agent, otelSpan, rule) {
  const activeTx = agent.tracer.getTransaction()
  // tx already exists do not create a new transaction
  if (activeTx) {
    rule.txTransformation = {}
    return createInternalSegment(agent, otelSpan, rule)
  }
  const spanContext = otelSpan.spanContext()
  const transaction = new Transaction(agent, spanContext?.traceId)
  const txTransformation = rule.txTransformation
  const system = otelSpan.attributes[txTransformation?.system]
  propagateTraceContext({ transaction, otelSpan, transport: system })
  const segment = agent.tracer.createSegment({
    id: spanContext?.spanId,
    recorder,
    name: otelSpan.name,
    parent: transaction.trace.root,
    transaction
  })
  transaction.baseSegment = segment
  return { segment, transaction, rule }
}
