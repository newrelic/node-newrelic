/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const genericRecorder = require('#agentlib/metrics/recorders/generic.js')
const { transformTemplate } = require('../utils.js')

module.exports = function createProducerSegment(agent, otelSpan, rule) {
  const context = agent.tracer.getContext()
  const segmentTransformation = rule.segmentTransformation
  const name = transformTemplate(segmentTransformation?.name?.template, otelSpan?.attributes)

  const segment = agent.tracer.createSegment({
    id: otelSpan?.spanContext()?.spanId,
    name,
    recorder: genericRecorder,
    parent: context.segment,
    transaction: context.transaction
  })
  return { segment, transaction: context.transaction, rule }
}
