/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { MeterProvider, PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics')
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http')
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api')

// This will capture internal errors from all OTel components, including the exporter.
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR)

const exporter = new OTLPMetricExporter({
  url: 'https://otlp.nr-data.net:443/v1/metrics',
  headers: { 'api-key': process.env.NEW_RELIC_LICENSE_KEY } // Prod ingest license key
})

const meterProvider = new MeterProvider({
  readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 1000 })]
})

const meter = meterProvider.getMeter('nodejs-agent-benchmarks')

/**
 * Sanitizes a string to create a valid metric name
 * by replacing slashes with dots and removing the '.bench.js' suffix.
 * @param str {string} The string to sanitize.
 * @returns {string} The sanitized string.
 */
function sanitize(str) {
  return str.replace(/\//g, '.').replace(/\.bench\.js$/, '').replace(/[\s-]/g, '_')
}

/**
 * Normalizes and sends metrics for a single benchmark file's results.
 * @param {object} benchmarkFileData The benchmark test file data e.g. { name: 'test.bench.js', parsedOutput: { 'test case 1': { metric1: 123, metric2: 456 }, ... } }
 * @param {object} attributes Common attributes to add to all metrics.
 */
function sendBenchmarkTestMetrics(benchmarkFileData, attributes = {}) {
  const fileName = benchmarkFileData.name
  const testCases = benchmarkFileData.parsedOutput

  if (!fileName || !testCases) {
    console.error('Could not process benchmark data due to invalid format:', benchmarkFileData)
    return
  }

  const suiteName = sanitize(fileName)
  console.log(`--- Sending metrics for ${fileName} ---`)

  for (const [caseName, measurements] of Object.entries(testCases)) {
    const sanitizedCaseName = sanitize(caseName)
    for (const [metricKey, metricValue] of Object.entries(measurements)) {
      if (typeof metricValue === 'number' && !isNaN(metricValue)) {
        const metricName = `nodejs_benchmark.${suiteName}.${sanitizedCaseName}.${metricKey}`
        const gauge = meter.createGauge(metricName)
        gauge.record(metricValue, attributes)
      }
    }
  }
}

module.exports = { sendBenchmarkTestMetrics, meterProvider }
