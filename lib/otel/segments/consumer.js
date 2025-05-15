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
    return createInternalSegment(agent, otelSpan)
  }
  const spanContext = otelSpan.spanContext()
  const transaction = new Transaction(agent, spanContext?.traceId)
  // TODO: this is hardcoded, it has been a stable attribute
  // i could add this into the config rules and map it but not sure just yet
  const system = otelSpan.attributes['messaging.system']
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
