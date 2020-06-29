/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var benchmark = require('../../lib/benchmark')
var Metrics = require('../../../lib/metrics')
var shared = require('./shared')


var suite = benchmark.createBenchmark({
  name: 'metrics.getOrCreateMetric',
  after: function() { metrics = new Metrics(1, {}, {}) }
})
var metrics = new Metrics(1, {}, {})

preOptMetrics()

suite.add({
  name: 'single unscoped',
  fn: function() {
    metrics.getOrCreateMetric(shared.getMetric(), null)
  }
})

suite.add({
  name: 'many unscoped',
  fn: function() {
    for (var i = 0; i < 100; ++i) {
      metrics.getOrCreateMetric(shared.getMetric(), null)
    }
  }
})

suite.add({
  name: 'single scoped',
  fn: function() {
    metrics.getOrCreateMetric(shared.getMetric(), shared.getScope())
  }
})

suite.add({
  name: 'many scoped',
  fn: function() {
    for (var i = 0; i < 100; ++i) {
      metrics.getOrCreateMetric(shared.getMetric(), shared.getScope())
    }
  }
})

suite.add({
  name: 'many mixed scope',
  fn: function() {
    for (var i = 0; i < 100; ++i) {
      metrics.getOrCreateMetric(shared.getMetric(), shared.getMaybeUnscoped())
    }
  }
})

suite.run()


function preOptMetrics() {
  var m = new Metrics(1, {}, {})
  for (var i = 0; i < 100000; ++i) {
    m.getOrCreateMetric(shared.getMetric(), shared.getMaybeUnscoped())
  }
}
