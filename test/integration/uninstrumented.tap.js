'use strict'

var tap        = require('tap')
  , test       = tap.test

// This doesn't test the core http and https modules because we can't detect if
// core modules have already been loaded.
test('all instrumented modules should be detected when uninstrumented',
     function (t) {
  var INSTRUMENTATIONS = require('../../lib/instrumentations')()

  // Include pg.js special case
  INSTRUMENTATIONS.push('pg.js')

  var loaded = []

  INSTRUMENTATIONS.forEach(function(module) {
    try {
      require(module)
      loaded.push(module)
    } catch(err) {}
  })

  var uninstrumented = require('../../lib/uninstrumented')
    , Metrics = require('../../lib/metrics')
    , MetricNormalizer = require('../../lib/metrics/normalizer')
    , MetricMapper     = require('../../lib/metrics/mapper')
    , mapper = new MetricMapper()
    , normalizer = new MetricNormalizer({}, 'metric name')
    , metrics = new Metrics(0, mapper, normalizer)

  var expected = []

  uninstrumented.check()
  uninstrumented.createMetrics(metrics)

  var metricsJSON = metrics.toJSON()

  var flagMetrics = metricsJSON.filter(function(metric) { return metric[0].name === 'Supportability/Uninstrumented' })
  t.equal(flagMetrics.length, 1, 'Uninstrumented flag metric present')

  if (flagMetrics.length !== 1) return t.end()

  t.ok(flagMetrics[0][1].callCount > 0, 'Callcount for uninstrumented flag metric > 0 (' + flagMetrics[0][1].callCount + ')')

  loaded.forEach(function(module) {
    var found = false

    metricsJSON.forEach(function(metric) {
      if (metric[0].name === 'Supportability/Uninstrumented/' + module) {
        t.ok(metric[1].callCount > 0, 'Callcount for ' + module + ' uninstrumented module metric > 0 (' + metric[1].callCount + ')')
        found = true
      }
    })

    if (!found) t.fail('No uninstrumented module metric found for ' + module)
  })

  t.end()
})
