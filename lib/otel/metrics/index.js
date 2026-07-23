/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { resourceFromAttributes } = require('@opentelemetry/resources')
const {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader
} = require('@opentelemetry/sdk-metrics')

const { proxySettingsPresent } = require('#agentlib/collector/http-agents.js')
const defaultLogger = require('../../logger').child({ component: 'opentelemetry-metrics' })
const NROTLPMetricExporter = require('./nr-exporter.js')
const NRCapturingExporter = require('./nr-capturing-exporter.js')
const SetupSignal = require('../setup-signal.js')
const ProxyingExporter = require('./proxying-exporter.js')
const generateProxyAgentFactory = require('./generate-proxy-agent-factory.js')

// See https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#maximum_delay_value
const MAXIMUM_TIMEOUT_TIME = 2 ^ 32 - 1

class SetupMetrics extends SetupSignal {
  /**
   * @type {ProxyingExporter}
   */
  #metricExporter

  /**
   * @type {MetricReader}
   * @see https://open-telemetry.github.io/opentelemetry-js/classes/_opentelemetry_sdk-metrics.MetricReader.html
   */
  #metricReader

  constructor({ agent, logger = defaultLogger } = {}) {
    super({ agent, logger })

    const { config } = agent

    // When we are in serverless mode, we want to flush the collected metrics
    // ourselves during agent harvest time. So we configure the periodic
    // reader to use an interval that is likely to never occur.
    let exportInterval = agent.serverlessMode === true
      ? MAXIMUM_TIMEOUT_TIME
      : config.opentelemetry.metrics.export_interval
    // We shouldn't need to adjust the timeout time when in serveless mode.
    // We shouldn't ever be issuing an HTTP request via the reader, so its
    // timeout doesn't matter. It just needs to be a valid value.
    let exportTimeout = config.opentelemetry.metrics.export_timeout
    if (exportInterval <= exportTimeout) {
      logger.warn(
        'opentelemetry.metrics.export_interval (%d) must be greater than export_timeout (%d). ' +
        'Using default values: export_interval=60000, export_timeout=10000',
        exportInterval,
        exportTimeout
      )
      exportInterval = 60_000
      exportTimeout = 10_000
    }

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
    this.#metricExporter = proxyExporter
    this.#metricReader = reader

    const getMeter = provider.getMeter
    provider.getMeter = function nrGetMeter(...args) {
      agent.metrics
        .getOrCreateMetric('Supportability/Metrics/Nodejs/OpenTelemetryBridge/getMeter')
        .incrementCallCount()

      const meter = getMeter.apply(provider, args)
      const proto = Object.getPrototypeOf(meter)
      const methods = Object.getOwnPropertyNames(proto).filter((name) => name.startsWith('create'))
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
            .getOrCreateMetric(`Supportability/Metrics/Nodejs/OpenTelemetryBridge/meter/${method}`)
            .incrementCallCount()
          return originals[method].apply(meter, args)
        }
      }

      return meter
    }

    this.coreApi.metrics.setGlobalMeterProvider(provider)

    agent.metrics
      .getOrCreateMetric('Supportability/Metrics/Nodejs/OpenTelemetryBridge/enabled')
      .incrementCallCount()

    if (agent.serverlessMode === false) {
      // We need access to `agent.config.entity_guid` in order to attach metrics
      // to the correct instrumentation entity. But that value is not available
      // until either at least the first firing of `agent.config.on('change')`, or
      // the `agent.on('started')` event. Which means that we can't finalize the
      // metrics client configuration until after the `started` event.
      logger.debug('Waiting for agent connect to finish bootstrapping OTEL metrics.')
      agent.on('started', postReady)
    } else {
      // In this case, we simply need to assign a capturing exporter to our
      // proxy so that we can manually collect metrics when the agent performs
      // a harvest during serverless mode execution.
      logger.debug('Finalizing OTEL metrics in serverless mode.')
      proxyExporter.exporter = new NRCapturingExporter({ logger })
      agent.emit('otelMetricsBootstrapped')
    }
    function postReady() {
      logger.debug('Agent connect finished. Finishing boostrap of OTEL metrics.')
      agent.removeListener('started', postReady)

      reader.collect().then(({ resourceMetrics: collectedMetrics }) => {
        const exporterConfig = {
          url: `https://${config.host}:${config.port}/v1/metrics`,
          headers: { 'api-key': config.license_key },
          temporalityPreference: AggregationTemporality.DELTA
        }
        if (proxySettingsPresent(agent.config) === true) {
          exporterConfig.httpAgentOptions = generateProxyAgentFactory({
            agentConfig: agent.config,
            logger
          })
        }

        proxyExporter.exporter = new NROTLPMetricExporter(
          exporterConfig,
          { agent, logger }
        )

        const resource = resourceFromAttributes({
          'entity.guid': config.entity_guid,
          ...config.otlp_resource_attributes
        })
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

  teardown() {
    this.coreApi.metrics.disable()
  }

  /**
   * Initiates a manual metrics collection and returns the resulting protobuf
   * array as a Base64 encoded string.
   *
   * @returns {Promise<string>} The encoded metrics data.
   */
  async flushToString() {
    const { resourceMetrics: collectedMetrics } = await this.#metricReader.collect()
    await new Promise((resolve) => {
      this.#metricExporter.exporter.export(collectedMetrics, () => {
        resolve()
      })
    })
    return this.#metricExporter.exporter.lastSerialization
  }
}

module.exports = SetupMetrics
