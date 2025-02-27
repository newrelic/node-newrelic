/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Accepts trace context payload if span has a parent. It will use the
 * span context to extract the traceId, traceFlags and trace state.
 *
 * @param {object} params to function
 * @param {Transaction} params.transaction active transaction
 * @param {object} params.otelSpan active span
 * @param {string} params.transport indicator of type of span(http, kafkajs, rabbitmq, etc)
 */
function propagateTraceContext({ transaction, otelSpan, transport }) {
  const spanContext = otelSpan.spanContext()
  const parentSpanId = otelSpan?.parentSpanId || otelSpan?.parentSpanContext?.spanId

  if (parentSpanId) {
    // prefix traceFlags with 0 as it is stored as a parsed int on spanContext
    const traceparent = `00-${spanContext.traceId}-${parentSpanId}-0${spanContext.traceFlags}`
    transaction.acceptTraceContextPayload(traceparent, spanContext?.traceState?.state, transport)
  }
}

module.exports = {
  propagateTraceContext
}
