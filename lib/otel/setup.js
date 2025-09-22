/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const opentelemetry = require('@opentelemetry/api')

const SetupLogs = require('./logs/index.js')
const SetupMetrics = require('./metrics/index.js')
const SetupTraces = require('./traces/index.js')
const ContextManager = require('./context-manager')
const TracePropagator = require('./trace-propagator')
const defaultLogger = require('../logger').child({ component: 'opentelemetry-bridge' })
const createOtelLogger = require('./logger')
const interceptSpanKey = require('./span-key-interceptor')

const signals = []

function setupOtel(agent, logger = defaultLogger) {
  if (agent.config.opentelemetry_bridge.enabled !== true) {
    logger.warn(
      '`opentelemetry_bridge` is not enabled, skipping setup of opentelemetry-bridge'
    )
    return
  }

  // When bridge mode is enabled, our context manager must utilize the OTEL
  // context manager. Otherwise, traces within, e.g. logs, will not be
  // captured correctly. The internal OTEL logger also must be configured
  // for the OTEL context manager to generate diagnostics messages that get
  // delivered to the correct place.
  createOtelLogger(logger, agent.config)
  interceptSpanKey(agent)
  opentelemetry.context.setGlobalContextManager(new ContextManager(agent))
  opentelemetry.propagation.setGlobalPropagator(new TracePropagator(agent))

  if (agent.config.opentelemetry_bridge.traces.enabled === true) {
    const signal = new SetupTraces({ agent })
    signals.push(signal)
  } else {
    logger.debug('`opentelemetry_bridge.traces` is not enabled, skipping')
    agent.metrics
      .getOrCreateMetric('Supportability/Tracing/Nodejs/OpenTelemetryBridge/disabled')
      .incrementCallCount()
  }

  if (agent.config.opentelemetry_bridge.metrics.enabled === true) {
    const signal = new SetupMetrics({ agent })
    signals.push(signal)
  } else {
    logger.debug('`opentelemetry_bridge.metrics` is not enabled, skipping')
    agent.metrics
      .getOrCreateMetric('Supportability/Metrics/Nodejs/OpenTelemetryBridge/disabled')
      .incrementCallCount()
  }

  if (agent.config.opentelemetry_bridge.logs.enabled === true) {
    const signal = new SetupLogs({ agent })
    signals.push(signal)
  } else {
    logger.debug('`opentelemetry_bridge.logs` is not enabled, skipping')
  }

  agent.metrics
    .getOrCreateMetric('Supportability/Nodejs/OpenTelemetryBridge/Setup')
    .incrementCallCount()
}

function teardownOtel(agent) {
  if (agent?.config?.opentelemetry_bridge?.enabled !== true) {
    return
  }

  for (const signal of signals) {
    signal.teardown()
  }

  opentelemetry.context.disable()
  opentelemetry.propagation.disable()
  opentelemetry.diag.disable()
}

module.exports = {
  setupOtel,
  teardownOtel
}
