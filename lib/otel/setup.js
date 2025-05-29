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
const TracePropagator = require('./trace-propagator')
const defaultLogger = require('../logger').child({ component: 'opentelemetry-bridge' })
const createOtelLogger = require('./logger')
const interceptSpanKey = require('./span-key-interceptor')
const bootstrapMetrics = require('./bootstrap-metrics')

function setupOtel(agent, logger = defaultLogger) {
  const otelIsEnabled = agent.config.feature_flag.opentelemetry_bridge &&
    agent.config.opentelemetry.bridge.enabled
  if (otelIsEnabled !== true) {
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

  if (agent.config.opentelemetry.metrics.enabled === true) {
    bootstrapMetrics(agent)
  } else {
    logger.debug('`opentelemetry.metrics` is not enabled, skipping')
  }

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
