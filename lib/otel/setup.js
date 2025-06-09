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
const bootstrapMetrics = require('./metrics/bootstrap-metrics')

function setupOtel(agent, logger = defaultLogger) {
  if (agent.config.opentelemetry_bridge.enabled !== true) {
    logger.warn(
      '`opentelemetry_bridge` is not enabled, skipping setup of opentelemetry-bridge'
    )
    return
  }

  if (agent.config.opentelemetry_bridge.traces.enabled === true) {
    bootstrapTraces(agent, logger)
  } else {
    logger.debug('`opentelemetry_bridge.traces` is not enabled, skipping')
  }

  if (agent.config.opentelemetry_bridge.metrics.enabled === true) {
    bootstrapMetrics(agent)
  } else {
    logger.debug('`opentelemetry_bridge.metrics` is not enabled, skipping')
  }

  agent.metrics
    .getOrCreateMetric('Supportability/Nodejs/OpenTelemetryBridge/Setup')
    .incrementCallCount()
}

function bootstrapTraces(agent, logger) {
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
    .getOrCreateMetric('Supportability/Nodejs/OpenTelemetryBridge/Traces')
    .incrementCallCount()
}

function teardownOtel(agent) {
  if (agent?.config?.opentelemetry_bridge?.enabled !== true) {
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
