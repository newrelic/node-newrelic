'use strict'

var INSTRUMENTATIONS = require('../../../lib/instrumentations')()
var Metrics = require('../../../lib/metrics')
var MetricNormalizer = require('../../../lib/metrics/normalizer')
var MetricMapper = require('../../../lib/metrics/mapper')
var tap = require('tap')
var uninstrumented = require('../../../lib/uninstrumented')

// Include pg.js and mysql2 special case
INSTRUMENTATIONS.push('pg.js', 'mysql2')

// This doesn't test the core http and https modules because we can't detect if
// core modules have already been loaded.
tap.test('all instrumented modules should be detected when uninstrumented', function(t) {
  var loaded = []

  INSTRUMENTATIONS.forEach(function(module) {
    try {
      require(module)
      loaded.push(module)
    } catch (err) {
      t.comment('failed to load ' + module)
    }
  })

  t.ok(loaded.length > 0, 'should have loaded at least one module')

  var mapper = new MetricMapper()
  var normalizer = new MetricNormalizer({}, 'metric name')
  var metrics = new Metrics(0, mapper, normalizer)

  uninstrumented.check()
  uninstrumented.createMetrics(metrics)

  var metricsJSON = metrics.toJSON()

  var flagMetrics = metricsJSON.filter(function(metric) {
    return metric[0].name === 'Supportability/Uninstrumented'
  })
  t.equal(flagMetrics.length, 1, 'Uninstrumented flag metric present')

  if (flagMetrics.length !== 1) return t.end()

  t.ok(
    flagMetrics[0][1].callCount > 0,
    'Callcount for uninstrumented flag metric > 0 (' + flagMetrics[0][1].callCount + ')'
  )

  loaded.forEach(function(module) {
    var found = false

    metricsJSON.forEach(function(metric) {
      if (metric[0].name === 'Supportability/Uninstrumented/' + module) {
        t.ok(metric[1].callCount > 0, 'should have uninstrumented metric for ' + module)
        found = true
      }
    })

    if (!found) t.fail('No uninstrumented module metric found for ' + module)
  })

  t.end()
})
