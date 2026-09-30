/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logsApi = require('@opentelemetry/api-logs')
const {
  isApplicationLoggingEnabled,
  isLogForwardingEnabled,
  isMetricsEnabled,
  incrementLoggingLinesMetrics
} = require('#agentlib/util/application-logging.js')

const defaultLogger = require('../../logger').child({ component: 'opentelemetry-metrics' })
const SetupSignal = require('../setup-signal.js')
const NrLoggerProvider = require('./nr-logger-provider.js')
const normalizeTimestamp = require('../utils/normalize-timestamp.js')
const severityToString = require('./severity-to-string.js')

class SetupLogs extends SetupSignal {
  constructor({ agent, logger = defaultLogger } = {}) {
    super({ agent, logger })

    if (isApplicationLoggingEnabled(agent.config) === false) {
      logger.info('application logging disabled, skipping otel logs setup')
      agent.metrics
        .getOrCreateMetric('Supportability/Logging/Nodejs/OpenTelemetryBridge/disabled')
        .incrementCallCount()
      return
    }

    agent.metrics
      .getOrCreateMetric('Supportability/Logging/Nodejs/OpenTelemetryBridge/enabled')
      .incrementCallCount()

    const provider = new NrLoggerProvider(nrEmitHandler, nrEnabledHandler)
    logsApi.logs.setGlobalLoggerProvider(provider)

    function nrEnabledHandler() {
      return isMetricsEnabled(agent.config) === true || isLogForwardingEnabled(agent.config, agent) === true
    }

    function nrEmitHandler(record, scope) {
      const level = severityToString(record.severityNumber ?? 0)
      if (isMetricsEnabled(agent.config) === true) {
        incrementLoggingLinesMetrics(level, agent.metrics)
      }

      // TODO: if we decide to support local decorating, implement it here

      if (isLogForwardingEnabled(agent.config, agent) === true) {
        const meta = agent.getLinkingMetadata(true)
        const timestamp = normalizeTimestamp(record.timestamp)
        const logData = {
          message: record.body,
          level,
          timestamp,
          ...record.attributes,
          ...meta
        }

        // We always attach the instrumentation scope data as log attributes
        // if the OTel Logger has them set.
        // See https://opentelemetry.io/docs/specs/otel/common/mapping-to-non-otlp/#instrumentationscope
        if (typeof scope?.name === 'string') {
          logData['otel.scope.name'] = scope.name
          logData['otel.library.name'] = scope.name
        }
        if (typeof scope?.version === 'string') {
          logData['otel.scope.version'] = scope.version
          logData['otel.library.version'] = scope.version
        }

        agent.logs.add(logData)
      }
    }

    agent.emit('otelLogsBootstrapped')
  }

  teardown() {
    logsApi.logs.disable()
  }
}

module.exports = SetupLogs
