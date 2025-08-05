/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { MeterProvider, PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics')
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http')

const exporter = new OTLPMetricExporter({
  url: 'https://otlp.nr-data.net:4318/v1/metrics',
  headers: { 'api-key': process.env.NEW_RELIC_LICENSE_KEY }
})

// Export the meterProvider so we can shut it down gracefully in the main script
const meterProvider = new MeterProvider({
  readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 1000 })]
})

const meter = meterProvider.getMeter('nodejs-agent-benchmarks')

function sanitize(str) {
  return str.replace(/\//g, '.').replace(/\.bench\.js$/, '').replace(/[\s-]/g, '_')
}

/**
 * Normalizes and sends metrics for a single benchmark file's results.
 * @param {object} benchmarkFileData The benchmark test file data e.g. { name: 'test.bench.js', parsedOutput: { 'test case 1': { metric1: 123, metric2: 456 }, ... } }
 * @param {object} attributes Common attributes to add to all metrics.
 */
async function sendBenchmarkTestMetrics(benchmarkFileData, attributes = {}) {
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
        const metricName = `benchmark.${suiteName}.${sanitizedCaseName}.${metricKey}`
        const gauge = meter.createGauge(metricName)
        gauge.record(metricValue, attributes)
      }
    }
  }

  // We can flush after each file to ensure data is sent, though the
  // PeriodicExportingMetricReader batches automatically. For CI, flushing is safer.
  try {
    await meterProvider.forceFlush()
  } catch (e) {
    console.error(`Error flushing metrics for ${fileName}:`, e)
  }
}

module.exports = { sendBenchmarkTestMetrics, meterProvider }
