/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = createConsumerSegment

// Notes:
// + https://github.com/open-telemetry/semantic-conventions/blob/v1.24.0/docs/messaging/messaging-spans.md
// + We probably want to inspect `messaging.system` so that we can generate
// attributes according to our own internal specs.

const Transaction = require('../../transaction/')
const recorder = require('../../metrics/recorders/message-transaction')
const { TYPES } = Transaction
const { propagateTraceContext } = require('./utils')
const { getMapping } = require('../attr-mapping/messaging')

const {
  UNKNOWN
} = require('../constants')

function createConsumerSegment(agent, otelSpan) {
  const spanContext = otelSpan.spanContext()
  const transaction = new Transaction(agent, spanContext?.traceId)
  transaction.type = TYPES.MESSAGE

  const { value: system = UNKNOWN } = getMapping({ key: 'system', span: otelSpan })
  const { value: destination = UNKNOWN } = getMapping({ key: 'destination', span: otelSpan })
  const { value: operation = UNKNOWN } = getMapping({ key: 'operation', span: otelSpan })
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
