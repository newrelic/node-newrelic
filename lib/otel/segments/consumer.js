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
const { DESTINATIONS, TYPES } = Transaction

const {
  ATTR_MESSAGING_DESTINATION,
  ATTR_MESSAGING_DESTINATION_KIND,
  ATTR_MESSAGING_SYSTEM
} = require('../constants')

function createConsumerSegment(agent, otelSpan) {
  const transaction = new Transaction(agent)
  transaction.type = TYPES.MESSAGE

  const system = otelSpan.attributes[ATTR_MESSAGING_SYSTEM] ?? 'unknown'
  const destination = otelSpan.attributes[ATTR_MESSAGING_DESTINATION] ?? 'unknown'
  const destKind = otelSpan.attributes[ATTR_MESSAGING_DESTINATION_KIND] ?? 'unknown'
  const segmentName = `${system}/${destKind}/Named/${destination}`

  const txAttrs = transaction.trace.attributes
  txAttrs.addAttribute(DESTINATIONS.TRANS_SCOPE, 'message.queueName', destination)
  // txAttrs.addAttribute(
  //   DESTINATIONS.TRANS_SCOPE,
  //   'host',
  //
  // )
  transaction.setPartialName(segmentName)

  const segment = agent.tracer.createSegment({
    recorder,
    name: transaction.getFullName(),
    parent: transaction.trace.root,
    transaction
  })
  transaction.baseSegment = segment

  return { segment, transaction }
}
