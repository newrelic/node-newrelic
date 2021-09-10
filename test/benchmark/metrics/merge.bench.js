/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const Metrics = require('../../../lib/metrics')
const shared = require('./shared')

const suite = benchmark.createBenchmark({
  name: 'metrics.merge'
})

preOptMetrics()

suite.add({
  name: '   1 metric ',
  fn: function () {
    const m1 = makeMetrics(1)
    const m2 = makeMetrics(1)

    m1.merge(m2)
  }
})

suite.add({
  name: '  10 metrics',
  fn: function () {
    const m1 = makeMetrics(10)
    const m2 = makeMetrics(10)

    m1.merge(m2)
  }
})

suite.add({
  name: ' 100 metrics',
  fn: function () {
    const m1 = makeMetrics(100)
    const m2 = makeMetrics(100)

    m1.merge(m2)
  }
})

suite.add({
  name: '1000 metrics',
  fn: function () {
    const m1 = makeMetrics(1000)
    const m2 = makeMetrics(1000)

    m1.merge(m2)
  }
})

suite.run()

function makeMetrics(num) {
  const metrics = new Metrics(1, {}, {})

  for (let i = 0; i < num; ++i) {
    metrics.getOrCreateMetric(shared.getMetric(), shared.getMaybeUnscoped())
  }

  return metrics
}

function preOptMetrics() {
  for (let i = 0; i < 1000; ++i) {
    const m1 = makeMetrics(i * 10)
    const m2 = makeMetrics(i * 10)
    m1.merge(m2)
  }
}
