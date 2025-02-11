/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { BasicTracerProvider } = require('@opentelemetry/sdk-trace-base')
const { Resource } = require('@opentelemetry/resources')
const NrSpanProcessor = require('./span-processor')
const ContextManager = require('./context-manager')
const defaultLogger = require('../logger').child({ component: 'opentelemetry-bridge' })
const createOtelLogger = require('./logger')
const TracePropagator = require('./trace-propagator')

const { ATTR_SERVICE_NAME } = require('./constants')

module.exports = function setupOtel(agent, logger = defaultLogger) {
  if (agent.config.feature_flag.opentelemetry_bridge !== true) {
    logger.warn(
      '`feature_flag.opentelemetry_bridge` is not enabled, skipping setup of opentelemetry-bridge'
    )
    return
  }

  createOtelLogger(logger, agent.config)

  const provider = new BasicTracerProvider({
    spanProcessors: [new NrSpanProcessor(agent)],
    resource: new Resource({
      [ATTR_SERVICE_NAME]: agent.config.applications()[0]
    }),
    generalLimits: {
      attributeValueLengthLimit: 4095
    }

  })
  provider.register({
    contextManager: new ContextManager(agent),
    propagator: new TracePropagator(agent)
  })

  agent.metrics
    .getOrCreateMetric('Supportability/Nodejs/OpenTelemetryBridge/Setup')
    .incrementCallCount()

  return provider
}
