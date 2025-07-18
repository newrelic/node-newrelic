/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const tspl = require('@matteo.collina/tspl')
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-proto')

const ProxyingExporter = require('#agentlib/otel/metrics/proxying-exporter.js')

test('proxies methods correctly', async (t) => {
  const plan = tspl(t, { plan: 8 })

  const target = new OTLPMetricExporter()
  target.export = (items, callback) => {
    plan.ok(items)
    plan.equal(typeof callback, 'function')
  }
  target.forceFlush = () => {
    plan.ok('forced flush')
  }
  target.selectAggregation = (instrumentType) => {
    plan.ok(instrumentType)
  }
  target.selectAggregationTemporality = (temporality) => {
    plan.ok(temporality)
  }
  target.shutdown = () => {
    plan.ok('shutdown')
  }

  const exporter = new ProxyingExporter({ exporter: target })
  exporter.export([1, 2, 3], () => {})
  exporter.forceFlush()
  exporter.selectAggregation('foo')
  exporter.selectAggregationTemporality('bar')
  exporter.shutdown()

  target.selectAggregation = undefined
  target.selectAggregationTemporality = undefined
  const agg = exporter.selectAggregation('whatever')
  plan.deepEqual(agg, { type: 0 })
  const temp = exporter.selectAggregationTemporality('a thing')
  plan.equal(temp, 0)
})
