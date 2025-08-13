/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const NR_KEY = process.env.NEW_RELIC_LICENSE_KEY
if (NR_KEY === null) {
  console.warn('Missing required environment variable: NEW_RELIC_LICENSE_KEY. Will not send metrics.')
}

const { MeterProvider, PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics')
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-proto')
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api')
const { resourceFromAttributes } = require('@opentelemetry/resources')

// This will capture internal errors from all OTel components, including the exporter.
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR)

const resource = resourceFromAttributes({
  'service.name': 'nodejs-benchmark-runner'
})

const exporter = new OTLPMetricExporter({
  url: 'https://otlp.nr-data.net:443/v1/metrics',
  headers: { 'api-key': NR_KEY } // Prod ingest license key
})

const meterProvider = new MeterProvider({
  resource,
  readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 1000 })]
})

const meter = meterProvider.getMeter('nodejs-agent-benchmarks')

// A single, reusable gauge for all benchmark measurements.
const benchmarkValueGauge = meter.createGauge('nodejs_benchmark.value', {
  description: 'The value of a specific benchmark measurement.'
})

/**
 * Sanitizes a string to create a valid metric name
 * by replacing slashes with dots and removing the '.bench.js' suffix.
 * @param {string} str The string to sanitize.
 * @returns {string} The sanitized string.
 */
function sanitize(str) {
  return str.replace(/\//g, '.').replace(/\.bench\.js$/, '').replace(/[\s-]/g, '_')
}

/**
 * Normalizes and sends metrics for a single benchmark file's results.
 * @param {object} benchmarkFileData The benchmark test file data e.g. { name: 'test.bench.js', parsedOutput: { 'test case 1': { mean: 123, max: 456 }, ... } }
 * @param {object} commonAttributes Common attributes to add to all metrics, like Node version.
 */
function sendBenchmarkTestMetrics(benchmarkFileData, commonAttributes = {}) {
  const fileName = benchmarkFileData.name
  const testCases = benchmarkFileData.parsedOutput

  if (!fileName || !testCases) {
    console.error('Could not process benchmark data due to invalid format:', benchmarkFileData)
    return
  }

  const suiteName = sanitize(fileName)
  console.log(`--- Sending metrics for ${fileName} ---`)

  // measurements will contain the following:
  // 'mean', 'max', 'min', 'median', '5thPercentile', '95thPercentile', 'stdDev', 'numSamples'
  for (const [caseName, measurements] of Object.entries(testCases)) {
    const sanitizedCaseName = sanitize(caseName)
    for (const [metricKey, metricValue] of Object.entries(measurements)) {
      if (metricKey === 'numSamples') continue
      if (typeof metricValue === 'number' && !isNaN(metricValue)) {
        const attributes = {
          ...commonAttributes,
          suite_name: suiteName,
          case_name: sanitizedCaseName,
          metric_type: metricKey,
          numSamples: measurements.numSamples
        }
        benchmarkValueGauge.record(metricValue, attributes)
      }
    }
  }
}

module.exports = { sendBenchmarkTestMetrics, meterProvider }
