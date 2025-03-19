/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  UNKNOWN
} = require('../constants')

const genericRecorder = require('../../metrics/recorders/generic')
const { getMapping } = require('../attr-mapping/messaging')

module.exports = function createProducerSegment(agent, otelSpan) {
  const context = agent.tracer.getContext()
  const name = setName(otelSpan)

  const segment = agent.tracer.createSegment({
    id: otelSpan?.spanContext()?.spanId,
    name,
    recorder: genericRecorder,
    parent: context.segment,
    transaction: context.transaction
  })
  return { segment, transaction: context.transaction }
}

function setName(otelSpan) {
  const { value: system = UNKNOWN } = getMapping({ key: 'system', span: otelSpan })
  const { value: operation = UNKNOWN } = getMapping({ key: 'operation', span: otelSpan })
  const { value: destination = UNKNOWN } = getMapping({ key: 'destination', span: otelSpan })
  return `MessageBroker/${system}/${operation}/Produce/Named/${destination}`
}
