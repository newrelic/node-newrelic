/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const genericRecorder = require('../../metrics/recorders/generic')
const transformationRules = require('../transformation-rules')
const { transformTemplate } = require('./utils')

module.exports = function createProducerSegment(agent, otelSpan, rule) {
  const context = agent.tracer.getContext()
  const transformationRule = transformationRules.find((tRule) => tRule.name === rule)
  const { segment: segmentTransformation } = transformationRule
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
