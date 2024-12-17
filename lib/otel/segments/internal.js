/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = function createInternalSegment(agent, otelSpan) {
  const context = agent.tracer.getContext()
  const name = `Custom/${otelSpan.name}`
  const segment = agent.tracer.createSegment({
    name,
    parent: context.segment,
    transaction: context.transaction
  })
  return { segment, transaction: context.transaction }
}
