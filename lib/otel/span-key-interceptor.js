/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const otelApi = require('@opentelemetry/api')

/**
 * Called before setting up the otel bridge ContextManager.
 * This creates a fake context and uses the otel api to set a span.
 * By creating a fake `setValue` when it will give us the symbol used for enqueueing spans to the context.
 * This is assigned as a key on the agent.
 * We will use this key to enqueue our FakeSpan when we enter a segment or transaction so that when using otel API it will return the appropriate traceId and spanId.
 *
 * @param {Agent} agent instance
 */
module.exports = function interceptSpanKey(agent) {
  const fakeCtx = {
    spanKey: null,
    setValue(key) {
      this.spanKey = key
    }
  }

  const fakeSpan = {}
  otelApi.trace.setSpan(fakeCtx, fakeSpan)
  agent.otelSpanKey = fakeCtx.spanKey
}
