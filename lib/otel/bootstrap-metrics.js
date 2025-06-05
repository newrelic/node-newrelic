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
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader
} = require('@opentelemetry/sdk-metrics')

/**
 * Configures the OpenTelemetry metrics API client to send metrics data
 * to New Relic.
 *
 * @param {Agent} agent The Node.js agent instance.
 * @fires Agent#otelMetricsBootstrapped
 */
function bootstrapOtelMetrics(agent) {
  const { config } = agent
  const resource = resourceFromAttributes({ })
  const reader = new PeriodicExportingMetricReader({
    exporter: new InMemoryMetricExporter(AggregationTemporality.DELTA),
    // We are setting a long initial export interval in order to give the
    // agent time to bootstrap. Once the agent is ready, we will reset the
    // interval to a customer defined value.
    exportIntervalMillis: 120_000
  })
  const provider = new MeterProvider({
    readers: [reader],
    resource
  })

  metrics.setGlobalMeterProvider(provider)

  agent.metrics
    .getOrCreateMetric('Supportability/Nodejs/OpenTelemetryBridge/Metrics')
    .incrementCallCount()

  // We need access to `agent.config.entity_guid` in order to attach metrics
  // to the correct instrumentation entity. But that value is not available
  // until either at least the first firing of `agent.config.on('change')`, or
  // the `agent.on('started')` event. Which means that we can't finalize the
  // metrics client configuration until after the `started` event.
  agent.on('started', postReady)
  function postReady() {
    agent.removeListener('started', postReady)

    reader.collect().then(({ resourceMetrics: collectedMetrics }) => {
      const exporter = new OTLPMetricExporter({
        url: `https://${config.host}:${config.port}/v1/metrics`,
        headers: {
          'api-key': config.license_key
        },
        temporalityPreference: AggregationTemporality.DELTA
      })
      // We have to re-define the reader, resource, and provider because
      // simply setting `provider.resource = resource` does not accomplish
      // anything useful.
      const reader = new PeriodicExportingMetricReader({
        exporter,
        // TODO: make configurable
        exportIntervalMillis: 1_000
      })
      const resource = resourceFromAttributes({ 'entity.guid': config.entity_guid })
      const provider = new MeterProvider({
        readers: [reader],
        resource
      })
      metrics.disable() // <== removes the current global provider
      metrics.setGlobalMeterProvider(provider)

      // Attempt to ship any metrics recorded prior to the `started` event.
      collectedMetrics.resource = resource
      exporter.export(collectedMetrics, () => {})

      agent.emit('otelMetricsBootstrapped')
    })
  }
}
