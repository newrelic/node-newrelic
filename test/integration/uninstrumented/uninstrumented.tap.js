/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Metrics = require('../../../lib/metrics')
const MetricNormalizer = require('../../../lib/metrics/normalizer')
const MetricMapper = require('../../../lib/metrics/mapper')
const tap = require('tap')
const uninstrumented = require('../../../lib/uninstrumented')
const helper = require('../../lib/agent_helper')
const shimmer = require('../../../lib/shimmer')

tap.test('does not mark files with known module names as uninstrumented', function(t) {
  const loaded = []

  require('./mock-config/redis')
  loaded.push('redis')

  t.ok(loaded.length > 0, 'should have loaded at least one module')

  const agent = helper.instrumentMockedAgent()

  t.tearDown(() => {
    helper.unloadAgent(agent)
  })

  const mapper = new MetricMapper()
  const normalizer = new MetricNormalizer({}, 'metric name')
  const metrics = new Metrics(0, mapper, normalizer)

  uninstrumented.check()
  uninstrumented.createMetrics(metrics)

  const flagMetrics = metrics.toJSON().filter(function(metric) {
    return metric[0].name === 'Supportability/Uninstrumented/redis'
  })
  t.equal(flagMetrics.length, 0, 'No uninstrumented flag metric present')

  t.end()
})

// This doesn't test the core http and https modules because we can't detect if
// core modules have already been loaded.
tap.test('all instrumented modules should be detected when uninstrumented', function(t) {
  const loaded = []

  const instrumentations = Object.keys(shimmer.registeredInstrumentations)
  // Include pg.js and mysql2 special case
  instrumentations.push('pg.js', 'mysql2')

  instrumentations.forEach(function(module) {
    // core module--will always be instrumented,
    // but still added to registeredInstrumentations
    if (module !== 'domain') {
      try {
        require(module)
        loaded.push(module)
      } catch (err) {
        t.comment('failed to load ' + module)
      }
    }
  })

  t.ok(loaded.length > 0, 'should have loaded at least one module')

  const agent = helper.instrumentMockedAgent()

  t.tearDown(() => {
    helper.unloadAgent(agent)
  })

  const mapper = new MetricMapper()
  const normalizer = new MetricNormalizer({}, 'metric name')
  const metrics = new Metrics(0, mapper, normalizer)

  uninstrumented.check()
  uninstrumented.createMetrics(metrics)

  const metricsJSON = metrics.toJSON()

  const flagMetrics = metricsJSON.filter(function(metric) {
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
