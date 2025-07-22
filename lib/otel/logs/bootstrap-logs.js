/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = bootstrapOtelLogs

const logsApi = require('@opentelemetry/api-logs')
const logsSdk = require('@opentelemetry/sdk-logs')
const defaultLogger = require('#agentlib/logger.js').child({ component: 'otel-logs' })
const {
  isApplicationLoggingEnabled,
  isLogForwardingEnabled,
  isMetricsEnabled,
  incrementLoggingLinesMetrics
} = require('#agentlib/util/application-logging.js')

const NewRelicLoggerProvider = require('./proxying-provider.js')
const NoOpExporter = require('./no-op-exporter.js')
const normalizeTimestamp = require('./normalize-timestamp.js')
const severityToString = require('./severity-to-string.js')

/**
 * Sets up the OTEL logging system and instruments it in such a fashion
 * that logs are shipped to New Relic when logs forwarding is enabled.
 *
 * The API, as of 2025-07, is in development. We should expect changes that
 * will require significant refactoring here. For example, we might need to
 * accept instances of various components, e.g. record processors, in order
 * for customer apps to work as they expect.
 *
 * @param {object} params Factory function parameters.
 * @param {Agent} params.agent The Node.js agent instance.
 * @param {object} [params.logger] An agent logger instance.
 */
function bootstrapOtelLogs({ agent, logger = defaultLogger } = {}) {
  if (isApplicationLoggingEnabled(agent.config) === false) {
    logger.info('application logging disabled, skipping otel logs setup')
    return
  }

  agent.metrics
    .getOrCreateMetric('Supportability/Nodejs/OpenTelemetryBridge/Logs')
    .incrementCallCount()

  const exporter = new NoOpExporter()
  const processor = new logsSdk.BatchLogRecordProcessor(exporter)
  const otelProvider = new logsSdk.LoggerProvider({
    processors: [processor]
  })
  const provider = new NewRelicLoggerProvider({
    agent,
    provider: otelProvider,
    emitHandler: nrEmitHandler
  })
  logsApi.logs.setGlobalLoggerProvider(provider)

  function nrEmitHandler(record) {
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

      agent.logs.add(logData)
    }
  }

  agent.emit('otelLogsBootstrapped')
}
