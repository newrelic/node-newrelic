/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const genericRecorder = require('../../metrics/recorders/generic')

module.exports = function createInternalSegment(agent, otelSpan) {
  const context = agent.tracer.getContext()
  const name = otelSpan.name
  const segment = agent.tracer.createSegment({
    id: otelSpan?.spanContext()?.spanId,
    name,
    parent: context.segment,
    recorder: genericRecorder,
    transaction: context.transaction
  })
  return { segment, transaction: context.transaction }
}
