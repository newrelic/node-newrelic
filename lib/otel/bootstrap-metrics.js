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
  AggregationType,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader
} = require('@opentelemetry/sdk-metrics')

/**
 * ProxyingExporter implements the `PushMetricExporter` interface. It stores
 * a reference to an actual exporter implementation and forwards all method
 * invocations to that underlying exporter. The benefit is that we can swap
 * out exporters in order to get around the limitations imposed by those
 * exporters. In particular, we can initially use an in-memory exporter to
 * collect metrics prior to the agent entering its ready state, and then swap
 * in an OTLP exporter configured from the agent details that have been
 * solidified during the agent's bootup process. We need to do this because
 * the OTLP exporter does not allow for changing the URL after it has been
 * constructed, and our agent _may_ receive a different destination URL
 * from the server during the bootup process. Since the `MeterProvider` is
 * the object that keeps references to any metrics recorders, the provider
 * stores a reference to the exporter, and the provider is an immutable
 * object, we can't simply create new instances.
 *
 * 1. We wouldn't be able to replace the existing exporter.
 * 2. Replacing the provider would mean all previously created recorders would
 * need to be re-created, or else they wouldn't actually record anything.
 *
 * @see https://github.com/open-telemetry/opentelemetry-js/blob/8dc74e6/packages/sdk-metrics/src/export/MetricExporter.ts#L28
 */
class ProxyingExporter {
  #exporter

  constructor({ exporter }) {
    this.exporter = exporter
  }

  get exporter() {
    return this.#exporter
  }

  set exporter(value) {
    this.#exporter = value
  }

  export(...args) {
    return this.#exporter.export.apply(this.#exporter, args)
  }

  forceFlush() {
    return this.#exporter.forceFlush()
  }

  selectAggregation(...args) {
    // Falls back to the default as shown in:
    // https://github.com/open-telemetry/opentelemetry-js/blob/8dc74e6/packages/sdk-metrics/src/export/AggregationSelector.ts#L35
    return this.#exporter.selectAggregation?.apply(this.#exporter, args) ?? { type: AggregationType.DEFAULT }
  }

  selectAggregationTemporality(...args) {
    // Falls back to the default as shown in:
    // https://github.com/open-telemetry/opentelemetry-js/blob/8dc74e6/packages/sdk-metrics/src/export/AggregationSelector.ts#L42
    return this.#exporter.selectAggregationTemporality?.apply(this.#exporter, args) ?? AggregationTemporality.DELTA
  }

  shutdown() {
    return this.#exporter.shutdown()
  }
}

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
