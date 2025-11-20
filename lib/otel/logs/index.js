/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logsApi = require('@opentelemetry/api-logs')
const logsSdk = require('@opentelemetry/sdk-logs')
const {
  isApplicationLoggingEnabled,
  isLogForwardingEnabled,
  isMetricsEnabled,
  incrementLoggingLinesMetrics
} = require('#agentlib/util/application-logging.js')

const defaultLogger = require('../../logger').child({ component: 'opentelemetry-metrics' })
const SetupSignal = require('../setup-signal.js')
const NewRelicLoggerProvider = require('./proxying-provider.js')
const NoOpExporter = require('./no-op-exporter.js')
const normalizeTimestamp = require('../normalize-timestamp.js')
const severityToString = require('./severity-to-string.js')

class SetupLogs extends SetupSignal {
  constructor({ agent, logger = defaultLogger } = {}) {
    super({ agent, logger })

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

  teardown() {
    logsApi.logs.disable()
  }
}

module.exports = SetupLogs
