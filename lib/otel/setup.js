/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { BasicTracerProvider } = require('@opentelemetry/sdk-trace-base')
const NrSpanProcessor = require('./span-processor')
const ContextManager = require('./context-manager')

module.exports = function setupOtel(agent) {
  if (agent.config.feature_flag.otel_bridge !== true) {
    agent.logger.warn(
      '`feature_flag.otel_bridge` is not enabled, not setting up opentelemetry_bridge.'
    )
    return
  }

  const provider = new BasicTracerProvider({
    spanProcessors: [new NrSpanProcessor(agent)]
  })
  provider.register({
    contextManager: new ContextManager(agent)
    // propagator: // w3c trace propagator
  })
}
