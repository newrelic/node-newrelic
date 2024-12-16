/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const NAMES = require('../../metrics/names')
const { SEMATTRS_HTTP_HOST } = require('@opentelemetry/semantic-conventions')

module.exports = function createHttpExternalSegment(agent, otelSpan) {
  const context = agent.tracer.getContext()
  const host = otelSpan.attributes[SEMATTRS_HTTP_HOST] || 'Unknown'
  const name = NAMES.EXTERNAL.PREFIX + host
  const segment = agent.tracer.createSegment({
    name,
    parent: context.segment,
    transaction: context.transaction
  })
  return { segment, transaction: context.transaction }
}
