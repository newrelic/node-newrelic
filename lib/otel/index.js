/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const opentelemetry = require('@opentelemetry/api')

const defaultLogger = require('../logger').child({ component: 'opentelemetry-bridge' })
const bootstrapMetrics = require('./metrics/bootstrap-metrics')
const bootstrapTraces = require('./bootstrap-traces')

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
