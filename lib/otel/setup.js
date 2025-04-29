/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const opentelemetry = require('@opentelemetry/api')
const { BasicTracerProvider } = require('@opentelemetry/sdk-trace-base')
const NrSpanProcessor = require('./span-processor')
const NrSampler = require('./sampler')
const ContextManager = require('./context-manager')
const defaultLogger = require('../logger').child({ component: 'opentelemetry-bridge' })
const createOtelLogger = require('./logger')
const TracePropagator = require('./trace-propagator')

const interceptSpanKey = require('./span-key-interceptor')

function setupOtel(agent, logger = defaultLogger) {
  if (agent.config.feature_flag.opentelemetry_bridge !== true) {
    logger.warn(
      '`feature_flag.opentelemetry_bridge` is not enabled, skipping setup of opentelemetry-bridge'
    )
    return
  }

  createOtelLogger(logger, agent.config)

  opentelemetry.trace.setGlobalTracerProvider(new BasicTracerProvider({
    sampler: new NrSampler(),
    spanProcessors: [new NrSpanProcessor(agent)],
    generalLimits: {
      attributeValueLengthLimit: 4095
    }
  }))

  interceptSpanKey(agent)
  opentelemetry.context.setGlobalContextManager(new ContextManager(agent))
  opentelemetry.propagation.setGlobalPropagator(new TracePropagator(agent))

  agent.metrics
    .getOrCreateMetric('Supportability/Nodejs/OpenTelemetryBridge/Setup')
    .incrementCallCount()
}

function teardownOtel(agent) {
  if (agent?.config?.feature_flag?.opentelemetry_bridge !== true) {
    return
  }

  opentelemetry.trace.disable()
  opentelemetry.context.disable()
  opentelemetry.propagation.disable()
  opentelemetry.diag.disable()
}

module.exports = {
  setupOtel,
  teardownOtel
}
