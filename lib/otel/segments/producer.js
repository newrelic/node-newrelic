/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  UNKNOWN
} = require('../constants')

const genericRecorder = require('../../metrics/recorders/generic')
const { msgAttr } = require('../attr-mapping/messaging')

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
  const system = msgAttr({ key: 'system', span: otelSpan }) ?? UNKNOWN
  const operation = msgAttr({ key: 'operation', span: otelSpan }) ?? UNKNOWN
  const destination = msgAttr({ key: 'destination', span: otelSpan }) ?? UNKNOWN
  return `MessageBroker/${system}/${operation}/Produce/Named/${destination}`
}
