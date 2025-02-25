/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

function propagateTraceContext({ transaction, otelSpan, transport }) {
  const spanContext = otelSpan.spanContext()

  if (otelSpan.parentSpanId) {
    // prefix traceFlags with 0 as it is stored as a parsed int on spanContext
    const traceparent = `00-${spanContext.traceId}-${otelSpan.parentSpanId}-0${spanContext.traceFlags}`
    transaction.acceptTraceContextPayload(traceparent, spanContext?.traceState?.state, transport)
  }
}

module.exports = {
  propagateTraceContext
}
