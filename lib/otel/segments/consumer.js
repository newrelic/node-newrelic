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

const {
  ATTR_MESSAGING_DESTINATION,
  ATTR_MESSAGING_DESTINATION_KIND,
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_SYSTEM
} = require('../constants')

function createConsumerSegment(agent, otelSpan) {
  const attrs = otelSpan.attributes
  const spanContext = otelSpan.spanContext()
  const transaction = new Transaction(agent, spanContext?.traceId)
  transaction.type = TYPES.MESSAGE

  const system = attrs[ATTR_MESSAGING_SYSTEM] ?? 'unknown'
  // _NAME is the current preferred attribute with semantic conventions >=1.3.0.
  const destination = attrs[ATTR_MESSAGING_DESTINATION_NAME] ?? attrs[ATTR_MESSAGING_DESTINATION] ?? 'unknown'
  const destKind = attrs[ATTR_MESSAGING_DESTINATION_KIND] ?? 'unknown'
  const segmentName = `${system}/${destKind}/Named/${destination}`

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
