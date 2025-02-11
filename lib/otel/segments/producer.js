/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  ATTR_MESSAGING_DESTINATION,
  ATTR_MESSAGING_DESTINATION_KIND,
  ATTR_MESSAGING_SYSTEM
} = require('../constants')

const genericRecorder = require('../../metrics/recorders/generic')

module.exports = function createProducerSegment(agent, otelSpan) {
  const context = agent.tracer.getContext()
  const name = setName(otelSpan)

  const segment = agent.tracer.createSegment({
    name,
    recorder: genericRecorder,
    parent: context.segment,
    transaction: context.transaction
  })
  return { segment, transaction: context.transaction }
}

function setName(otelSpan) {
  const system = otelSpan.attributes[ATTR_MESSAGING_SYSTEM] || 'Unknown'
  const destKind = otelSpan.attributes[ATTR_MESSAGING_DESTINATION_KIND] || 'Unknown'
  const destination = otelSpan.attributes[ATTR_MESSAGING_DESTINATION] || 'Unknown'
  return `MessageBroker/${system}/${destKind}/Produce/Named/${destination}`
}
