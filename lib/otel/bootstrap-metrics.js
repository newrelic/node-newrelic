/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = bootstrapOtelMetrics

const { metrics } = require('@opentelemetry/api')
const { resourceFromAttributes } = require('@opentelemetry/resources')
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-proto')
const {
  AggregationTemporality,
  MeterProvider,
  PeriodicExportingMetricReader
} = require('@opentelemetry/sdk-metrics')

function bootstrapOtelMetrics(agent) {
  // We need access to `agent.config.entity_guid` in order to attach metrics
  // to the correct instrumentation entity. But that value is not available
  // until either at least the first firing of `agent.config.on('change')`, or
  // the `agent.on('started')` event. So we need to defer configuring the
  // metrics provider until that point. Which means metrics are not trustworthy
  // until after the agent has finished starting.
  agent.on('started', configureMetrics)

  function configureMetrics() {
    agent.removeListener('started', configureMetrics)

    const { config } = agent
    const resource = config.entity_guid
      ? resourceFromAttributes({ 'entity.guid': config.entity_guid })
      : undefined
    const exporter = new OTLPMetricExporter({
      url: `https://${config.host}/v1/metrics`,
      headers: {
        'api-key': config.license_key
      },
      temporalityPreference: AggregationTemporality.DELTA
    })
    const reader = new PeriodicExportingMetricReader({
      exporter,
      // TODO: make configurable
      exportIntervalMillis: 1_000
    })
    const provider = new MeterProvider({
      readers: [reader],
      resource
    })

    metrics.setGlobalMeterProvider(provider)
  }
}
