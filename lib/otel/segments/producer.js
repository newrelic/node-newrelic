/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const {
  SEMATTRS_MESSAGING_SYSTEM,
  SEMATTRS_MESSAGING_DESTINATION,
  SEMATTRS_MESSAGING_DESTINATION_KIND
} = require('@opentelemetry/semantic-conventions')

module.exports = function createProducerSegment(agent, otelSpan) {
  const context = agent.tracer.getContext()
  const name = setName(otelSpan)
  const segment = agent.tracer.createSegment({
    name,
    parent: context.segment,
    transaction: context.transaction
  })
  return { segment, transaction: context.transaction }
}

function setName(otelSpan) {
  const system = otelSpan.attributes[SEMATTRS_MESSAGING_SYSTEM] || 'Unknown'
  const destKind = otelSpan.attributes[SEMATTRS_MESSAGING_DESTINATION_KIND] || 'Unknown'
  const destination = otelSpan.attributes[SEMATTRS_MESSAGING_DESTINATION] || 'Unknown'
  return `MessageBroker/${system}/${destKind}/Produce/Named/${destination}`
}
