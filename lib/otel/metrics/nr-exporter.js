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
  constructor(config = {}, logger = defaultLogger) {
    const convertedOptions = convertLegacyHttpOptions(
      config,
      'METRICS',
      'v1/metrics',
      { 'Content-Type': 'application/x-protobuf' }
    )

    const delegate = createOtlpHttpExportDelegate(
      convertedOptions,
      new NRProxyingSerializer({ destinationUrl: config.url, logger })
    )
    const proxyingDelegate = new NRProxyingDelegate(delegate, logger)

    super(proxyingDelegate, config)
  }
}

module.exports = NROTLPMetricExporter
