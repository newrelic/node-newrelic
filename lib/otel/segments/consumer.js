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
const { DESTINATIONS, TYPES } = Transaction

const {
  SEMATTRS_MESSAGING_SYSTEM,
  SEMATTRS_MESSAGING_DESTINATION,
  SEMATTRS_MESSAGING_DESTINATION_KIND
} = require('@opentelemetry/semantic-conventions')

function createConsumerSegment(agent, otelSpan) {
  const transaction = new Transaction(agent)
  transaction.type = TYPES.BG

  const system = otelSpan.attributes[SEMATTRS_MESSAGING_SYSTEM] ?? 'unknown'
  const destination = otelSpan.attributes[SEMATTRS_MESSAGING_DESTINATION] ?? 'unknown'
  const destKind = otelSpan.attributes[SEMATTRS_MESSAGING_DESTINATION_KIND] ?? 'unknown'
  const segmentName = `OtherTransaction/Message/${system}/${destKind}/Named/${destination}`

  const txAttrs = transaction.trace.attributes
  txAttrs.addAttribute(DESTINATIONS.TRANS_SCOPE, 'message.queueName', destination)
  // txAttrs.addAttribute(
  //   DESTINATIONS.TRANS_SCOPE,
  //   'host',
  //
  // )
  transaction.name = segmentName

  const segment = agent.tracer.createSegment({
    name: segmentName,
    parent: transaction.trace.root,
    transaction
  })
  transaction.baseSegment = segment

  return { segment, transaction }
}
