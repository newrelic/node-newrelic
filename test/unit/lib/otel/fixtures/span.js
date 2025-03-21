/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { ROOT_CONTEXT, TraceFlags } = require('@opentelemetry/api')
const { Span } = require('@opentelemetry/sdk-trace-base')

module.exports = function createSpan({ parentId, tracer, tx, kind, name, spanContext }) {
  spanContext = spanContext || {
    traceId: tx?.traceId,
    spanId: tx?.trace?.root?.id,
    traceFlags: TraceFlags.SAMPLED
  }
  return new Span(tracer, ROOT_CONTEXT, name, spanContext, kind, parentId)
}
