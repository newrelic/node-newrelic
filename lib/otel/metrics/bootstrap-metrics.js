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

const ProxyingExporter = require('./proxying-exporter.js')

/**
 * Configures the OpenTelemetry metrics API client to send metrics data
 * to New Relic.
 *
 * @param {Agent} agent The Node.js agent instance.
 * @fires Agent#otelMetricsBootstrapped
 */
function bootstrapOtelMetrics(agent) {
  const { config } = agent
  const exportInterval = config.opentelemetry_bridge.metrics.exportInterval
  const exportTimeout = config.opentelemetry_bridge.metrics.exportTimeout

  const resource = resourceFromAttributes({ })
  const memExporter = new InMemoryMetricExporter(AggregationTemporality.DELTA)
  const proxyExporter = new ProxyingExporter({ exporter: memExporter })
  const reader = new PeriodicExportingMetricReader({
    exporter: proxyExporter,
    exportIntervalMillis: exportInterval,
    exportTimeoutMillis: exportTimeout
  })
  const provider = new MeterProvider({
    readers: [reader],
    resource
  })

  const getMeter = provider.getMeter
  provider.getMeter = function nrGetMeter(...args) {
    agent.metrics
      .getOrCreateMetric('Supportability/Nodejs/OpenTelemetryBridge/Metrics/getMeter')
      .incrementCallCount()

    const meter = getMeter.apply(provider, args)
    const proto = Object.getPrototypeOf(meter)
    const methods = Object.getOwnPropertyNames(proto).filter(name => name.startsWith('create'))
    const originals = {}
    for (const method of methods) {
      originals[method] = meter[method]
      // As of 2025-06-17:
      // + createGauge
      // + createHistogram
      // + createCounter
      // + createUpDownCounter
      // + createObservableGauge
      // + createObservableCounter
      // + createObservableUpDownCounter
      meter[method] = function nrWrappedMethod(...args) {
        agent.metrics
          .getOrCreateMetric(`Supportability/Nodejs/OpenTelemetryBridge/Metrics/meter/${method}`)
          .incrementCallCount()
        return originals[method].apply(meter, args)
      }
    }

    return meter
  }

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
      proxyExporter.exporter = new OTLPMetricExporter({
        url: `https://${config.host}:${config.port}/v1/metrics`,
        headers: {
          'api-key': config.license_key
        },
        temporalityPreference: AggregationTemporality.DELTA
      })

      const resource = resourceFromAttributes({ 'entity.guid': config.entity_guid })
      // Assigning the resource after having received the `entity.guid` from
      // the server is a key detail of this implementation. Unfortunately,
      // we don't have real public access to the object that retains the
      // resource reference. If upstream ever hides this from us, we'll be
      // in a bit of a bind.
      provider._sharedState.resource = resource

      // Attempt to ship any metrics recorded prior to the `started` event.
      collectedMetrics.resource = resource
      proxyExporter.exporter.export(collectedMetrics, () => {})

      agent.emit('otelMetricsBootstrapped')
    })
  }
}
