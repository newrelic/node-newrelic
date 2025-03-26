/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = createConsumerSegment

const Transaction = require('../../transaction/')
const recorder = require('../../metrics/recorders/message-transaction')
const { TYPES } = Transaction
const { propagateTraceContext } = require('./utils')
const { msgAttr } = require('../attr-mapping/messaging')

const {
  UNKNOWN
} = require('../constants')

function createConsumerSegment(agent, otelSpan) {
  const spanContext = otelSpan.spanContext()
  const transaction = new Transaction(agent, spanContext?.traceId)
  transaction.type = TYPES.MESSAGE

  const system = msgAttr({ key: 'system', span: otelSpan }) ?? UNKNOWN
  const destination = msgAttr({ key: 'destination', span: otelSpan }) ?? UNKNOWN
  const operation = msgAttr({ key: 'operation', span: otelSpan }) ?? UNKNOWN
  const segmentName = `${system}/${operation}/Named/${destination}`

  transaction.setPartialName(segmentName)
  propagateTraceContext({ transaction, otelSpan, transport: system })

  const segment = agent.tracer.createSegment({
    id: spanContext?.spanId,
    recorder,
    name: transaction.getFullName(),
    parent: transaction.trace.root,
    transaction
  })
  transaction.baseSegment = segment

  return { segment, transaction }
}
