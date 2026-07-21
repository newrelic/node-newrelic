/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// The majority of dependencies in this module are lazy loaded in order to
// limit the impact on memory usage. In general, the OTEL dependencies are
// only loaded when they are needed, because they can have a significant
// impact once loaded.
const defaultLogger = require('../logger').child({ component: 'opentelemetry-bridge' })

const signals = []

/**
 * Bootstraps the Open Telemetry tracing signals. The provided agent instance
 * will have its `.otel` property updated with an API object if any signals
 * are enabled.
 *
 * @param {Agent} agent The current agent instance.
 * @param {AgentLogger} logger Agent logger instance.
 */
function setupOtel(agent, logger = defaultLogger) {
  if (agent.config.opentelemetry.enabled !== true) {
    logger.warn(
      '`opentelemetry` is not enabled, skipping setup of opentelemetry'
    )
    return
  }

  const opentelemetry = require('@opentelemetry/api')
  const ContextManager = require('./context-manager')
  const TracePropagator = require('./trace-propagator')
  const createOtelLogger = require('./logger')
  const interceptSpanKey = require('./span-key-interceptor')

  // When bridge mode is enabled, our context manager must utilize the OTEL
  // context manager. Otherwise, traces within, e.g. logs, will not be
  // captured correctly. The internal OTEL logger also must be configured
  // for the OTEL context manager to generate diagnostics messages that get
  // delivered to the correct place.
  createOtelLogger(logger, agent.config)
  interceptSpanKey(agent)
  opentelemetry.context.setGlobalContextManager(new ContextManager(agent))
  opentelemetry.propagation.setGlobalPropagator(new TracePropagator(agent))

  const api = {
    logs: undefined,
    metrics: undefined,
    traces: undefined
  }
  agent.otel = api

  if (agent.config.opentelemetry.traces.enabled === true) {
    const SetupTraces = require('./traces/index.js')
    const signal = new SetupTraces({ agent })
    signals.push(signal)
    api.traces = signal
  } else {
    logger.debug('`opentelemetry.traces` is not enabled, skipping')
    agent.metrics
      .getOrCreateMetric('Supportability/Tracing/Nodejs/OpenTelemetryBridge/disabled')
      .incrementCallCount()
  }

  if (agent.config.opentelemetry.metrics.enabled === true) {
    const SetupMetrics = require('./metrics/index.js')
    const signal = new SetupMetrics({ agent })
    signals.push(signal)
    api.metrics = signal
  } else {
    logger.debug('`opentelemetry.metrics` is not enabled, skipping')
    agent.metrics
      .getOrCreateMetric('Supportability/Metrics/Nodejs/OpenTelemetryBridge/disabled')
      .incrementCallCount()
  }

  if (agent.config.opentelemetry.logs.enabled === true) {
    const SetupLogs = require('./logs/index.js')
    const signal = new SetupLogs({ agent })
    signals.push(signal)
    api.logs = signal
  } else {
    logger.debug('`opentelemetry.logs` is not enabled, skipping')
  }

  agent.metrics
    .getOrCreateMetric('Supportability/Nodejs/OpenTelemetryBridge/Setup')
    .incrementCallCount()
}

function teardownOtel(agent, { opentelemetry = require('@opentelemetry/api') } = {}) {
  if (agent?.config?.opentelemetry?.enabled !== true) {
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
