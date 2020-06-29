/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var benchmark = require('../../lib/benchmark')
var Metrics = require('../../../lib/metrics')
var shared = require('./shared')


var suite = benchmark.createBenchmark({
  name: 'metrics.merge'
})

preOptMetrics()

suite.add({
  name: '   1 metric ',
  fn: function() {
    var m1 = makeMetrics(1)
    var m2 = makeMetrics(1)

    m1.merge(m2)
  }
})

suite.add({
  name: '  10 metrics',
  fn: function() {
    var m1 = makeMetrics(10)
    var m2 = makeMetrics(10)

    m1.merge(m2)
  }
})

suite.add({
  name: ' 100 metrics',
  fn: function() {
    var m1 = makeMetrics(100)
    var m2 = makeMetrics(100)

    m1.merge(m2)
  }
})

suite.add({
  name: '1000 metrics',
  fn: function() {
    var m1 = makeMetrics(1000)
    var m2 = makeMetrics(1000)

    m1.merge(m2)
  }
})


suite.run()

function makeMetrics(num) {
  var metrics = new Metrics(1, {}, {})

  for (var i = 0; i < num; ++i) {
    metrics.getOrCreateMetric(shared.getMetric(), shared.getMaybeUnscoped())
  }

  return metrics
}


function preOptMetrics() {
  for (var i = 0; i < 1000; ++i) {
    var m1 = makeMetrics(i * 10)
    var m2 = makeMetrics(i * 10)
    m1.merge(m2)
  }
}
