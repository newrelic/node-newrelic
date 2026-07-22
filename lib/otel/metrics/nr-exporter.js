/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  OTLPMetricExporterBase
} = require('@opentelemetry/exporter-metrics-otlp-http')
const {
  convertLegacyHttpOptions,
  createOtlpHttpExportDelegate
} = require('@opentelemetry/otlp-exporter-base/node-http')
const defaultLogger = require('#agentlib/logger.js').child({
  component: 'nr-otlp-metric-exporter'
})
const NRProxyingDelegate = require('./nr-proxying-delegate.js')
const NRProxyingSerializer = require('./nr-proxying-serializer.js')

/**
 * Provides the functionality of upstream's `OTLPMetricExporter`, but wraps
 * the internal objects so that we can write audit logs.
 */
class NROTLPMetricExporter extends OTLPMetricExporterBase {
  #serializer

  /**
   * @param {object} config Standard OTEL exporter configuration object. You
   * have to dig through the OTEL source code to figure out what all it
   * supports.
   * @param {object} deps Local dependency injections.
   * @param {object} deps.agent Current agent instance.
   * @param {AgentLogger} deps.logger Agent logger instance.
   */
  constructor(config = {}, { agent, logger = defaultLogger } = {}) {
    const convertedOptions = convertLegacyHttpOptions(
      config,
      'METRICS',
      'v1/metrics',
      { 'Content-Type': 'application/x-protobuf' }
    )

    const serializer = new NRProxyingSerializer({
      awsLambdaMode: agent.serverlessMode,
      destinationUrl: config.url,
      logger
    })
    const delegate = createOtlpHttpExportDelegate(convertedOptions, serializer)
    const proxyingDelegate = new NRProxyingDelegate(delegate, { agent, logger })

    super(proxyingDelegate, config)

    this.#serializer = serializer
  }

  /**
   * @returns {string} Base64 encoded protobuf array.
   */
  get serializedData() {
    return this.#serializer.lastSerialization
  }
}

module.exports = NROTLPMetricExporter
