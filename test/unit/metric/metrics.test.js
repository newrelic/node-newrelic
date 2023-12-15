/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const helper = require('../../lib/agent_helper')
const Metrics = require('../../../lib/metrics')
const MetricMapper = require('../../../lib/metrics/mapper')
const MetricNormalizer = require('../../../lib/metrics/normalizer')

function beforeEach(t) {
  const agent = helper.loadMockedAgent()
  t.context.metrics = new Metrics(agent.config.apdex_t, agent.mapper, agent.metricNameNormalizer)
  t.context.agent = agent
}

function afterEach(t) {
  helper.unloadAgent(t.context.agent)
}

tap.test('Metrics', function (t) {
  t.autoend()
  t.test('when creating', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should throw if apdexT is not set', function (t) {
      const { agent } = t.context
      t.throws(function () {
        // eslint-disable-next-line no-new
        new Metrics(undefined, agent.mapper, agent.metricNameNormalizer)
      })
      t.end()
    })

    t.test('should throw if no name -> ID mapper is provided', function (t) {
      const { agent } = t.context
      t.throws(function () {
        // eslint-disable-next-line no-new
        new Metrics(agent.config.apdex_t, undefined, agent.metricNameNormalizer)
      })
      t.end()
    })

    t.test('should throw if no metric name normalizer is provided', function (t) {
      const { agent } = t.context
      t.throws(function () {
        // eslint-disable-next-line no-new
        new Metrics(agent.config.apdex_t, agent.mapper, undefined)
      })
      t.end()
    })

    t.test('should return apdex summaries with an apdexT same as config', function (t) {
      const { metrics, agent } = t.context
      const metric = metrics.getOrCreateApdexMetric('Apdex/MetricsTest')
      t.equal(metric.apdexT, agent.config.apdex_t)
      t.end()
    })

    t.test('should allow overriding apdex summaries with a custom apdexT', function (t) {
      const { metrics } = t.context
      const metric = metrics.getOrCreateApdexMetric('Apdex/MetricsTest', null, 1)
      t.equal(metric.apdexT, 0.001)
      t.end()
    })

    t.test('should require the overriding apdex to be greater than 0', function (t) {
      const { metrics, agent } = t.context
      const metric = metrics.getOrCreateApdexMetric('Apdex/MetricsTest', null, 0)
      t.equal(metric.apdexT, agent.config.apdex_t)
      t.end()
    })

    t.test('should require the overriding apdex to not be negative', function (t) {
      const { metrics, agent } = t.context
      const metric = metrics.getOrCreateApdexMetric('Apdex/MetricsTest', null, -5000)
      t.equal(metric.apdexT, agent.config.apdex_t)
      t.end()
    })

    t.test('when creating individual apdex metrics should have apdex functions', function (t) {
      const { metrics } = t.context
      const metric = metrics.getOrCreateApdexMetric('Agent/ApdexTest')
      t.ok(metric.incrementFrustrating)
      t.end()
    })

    t.test('should measure an unscoped metric', function (t) {
      const { metrics } = t.context
      metrics.measureMilliseconds('Test/Metric', null, 400, 200)
      t.equal(
        JSON.stringify(metrics.toJSON()),
        '[[{"name":"Test/Metric"},[1,0.4,0.2,0.4,0.4,0.16000000000000003]]]'
      )
      t.end()
    })

    t.test('should measure a scoped metric', function (t) {
      const { metrics } = t.context
      metrics.measureMilliseconds('T/M', 'T', 400, 200)
      t.equal(
        JSON.stringify(metrics.toJSON()),
        '[[{"name":"T/M","scope":"T"},[1,0.4,0.2,0.4,0.4,0.16000000000000003]]]'
      )
      t.end()
    })

    t.test('should resolve the correctly scoped set of metrics when scope passed', function (t) {
      const { metrics } = t.context
      metrics.measureMilliseconds('Apdex/ScopedMetricsTest', 'TEST')
      const scoped = metrics._resolve('TEST')

      t.ok(scoped['Apdex/ScopedMetricsTest'])
      t.end()
    })

    t.test('should implicitly create a blank set of metrics when resolving new scope', (t) => {
      const { metrics } = t.context
      const scoped = metrics._resolve('NOEXISTBRO')

      t.ok(scoped)
      t.equal(Object.keys(scoped).length, 0)
      t.end()
    })

    t.test('should return a preëxisting unscoped metric when it is requested', function (t) {
      const { metrics } = t.context
      metrics.measureMilliseconds('Test/UnscopedMetric', null, 400, 200)
      t.equal(metrics.getOrCreateMetric('Test/UnscopedMetric').callCount, 1)
      t.end()
    })

    t.test('should return a preëxisting scoped metric when it is requested', function (t) {
      const { metrics } = t.context
      metrics.measureMilliseconds('Test/Metric', 'TEST', 400, 200)
      t.equal(metrics.getOrCreateMetric('Test/Metric', 'TEST').callCount, 1)
      t.end()
    })

    t.test('should return the unscoped metrics when scope not set', function (t) {
      const { metrics } = t.context
      metrics.measureMilliseconds('Test/UnscopedMetric', null, 400, 200)
      t.equal(Object.keys(metrics._resolve()).length, 1)
      t.equal(Object.keys(metrics.scoped).length, 0)
      t.end()
    })

    t.test('should measure bytes ok', function (t) {
      const { metrics } = t.context
      const MEGABYTE = 1024 * 1024
      const stat = metrics.measureBytes('Test/Bytes', MEGABYTE)
      t.equal(stat.total, 1)
      t.equal(stat.totalExclusive, 1)
      t.end()
    })

    t.test('should measure exclusive bytes ok', function (t) {
      const { metrics } = t.context
      const MEGABYTE = 1024 * 1024
      const stat = metrics.measureBytes('Test/Bytes', MEGABYTE * 2, MEGABYTE)
      t.equal(stat.total, 2)
      t.equal(stat.totalExclusive, 1)
      t.end()
    })

    t.test('should optionally not convert bytes to megabytes', function (t) {
      const { metrics } = t.context
      const MEGABYTE = 1024 * 1024
      const stat = metrics.measureBytes('Test/Bytes', MEGABYTE * 2, MEGABYTE, true)
      t.equal(stat.total, MEGABYTE * 2)
      t.equal(stat.totalExclusive, MEGABYTE)
      t.end()
    })
  })

  t.test('when creating individual metrics', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should create a metric when a nonexistent name is requested', function (t) {
      const { metrics } = t.context
      const metric = metrics.getOrCreateMetric('Test/Nonexistent', 'TEST')
      t.equal(metric.callCount, 0)
      t.end()
    })

    t.test('should have statistics available', function (t) {
      const { metrics } = t.context
      const metric = metrics.getOrCreateMetric('Agent/Test')
      t.equal(metric.callCount, 0)
      t.end()
    })

    t.test('should have have regular functions', function (t) {
      const { metrics } = t.context
      const metric = metrics.getOrCreateMetric('Agent/StatsTest')
      t.equal(metric.callCount, 0)
      t.end()
    })
  })

  t.test('when creating with parameters', function (t) {
    t.autoend()
    const TEST_APDEX = 0.4
    const TEST_MAPPER = new MetricMapper([[{ name: 'Renamed/333' }, 1337]])
    const TEST_NORMALIZER = new MetricNormalizer({ enforce_backstop: true }, 'metric name')

    t.beforeEach(function (t) {
      beforeEach(t)
      TEST_NORMALIZER.addSimple(/^Test\/RenameMe(.*)$/, 'Renamed/$1')
      t.context.metrics = new Metrics(TEST_APDEX, TEST_MAPPER, TEST_NORMALIZER)
    })

    t.afterEach(afterEach)

    t.test('should pass apdex through to ApdexStats', function (t) {
      const { metrics } = t.context
      const apdex = metrics.getOrCreateApdexMetric('Test/RenameMe333')
      t.equal(apdex.apdexT, TEST_APDEX)
      t.end()
    })

    t.test('should pass metric mappings through for serialization', function (t) {
      const { metrics } = t.context
      metrics.measureMilliseconds('Test/RenameMe333', null, 400, 300)
      const summary = JSON.stringify(metrics.toJSON())
      t.equal(summary, '[[1337,[1,0.4,0.3,0.4,0.4,0.16000000000000003]]]')
      t.end()
    })
  })

  t.test('with ordinary statistics', function (t) {
    t.autoend()
    const NAME = 'Agent/Test384'

    t.beforeEach(function (t) {
      beforeEach(t)
      const metric = t.context.metrics.getOrCreateMetric(NAME)
      const mapper = new MetricMapper([[{ name: NAME }, 1234]])
      t.context.metric = metric
      t.context.mapper = mapper
    })

    t.afterEach(afterEach)

    t.test('should get the bare stats right', function (t) {
      const { metrics } = t.context
      const summary = JSON.stringify(metrics._getUnscopedData(NAME))
      t.equal(summary, '[{"name":"Agent/Test384"},[0,0,0,0,0,0]]')
      t.end()
    })

    t.test('should correctly map metrics to IDs given a mapping', function (t) {
      const { metrics, mapper } = t.context
      metrics.mapper = mapper
      const summary = JSON.stringify(metrics._getUnscopedData(NAME))
      t.equal(summary, '[1234,[0,0,0,0,0,0]]')
      t.end()
    })

    t.test('should correctly serialize statistics', function (t) {
      const { metrics, metric } = t.context
      metric.recordValue(0.3, 0.1)
      const summary = JSON.stringify(metrics._getUnscopedData(NAME))
      t.equal(summary, '[{"name":"Agent/Test384"},[1,0.3,0.1,0.3,0.3,0.09]]')
      t.end()
    })
  })

  t.test('with apdex statistics', function (t) {
    t.autoend()
    const NAME = 'Agent/Test385'
    t.beforeEach(function (t) {
      beforeEach(t)
      const { agent } = t.context
      const metrics = new Metrics(0.8, new MetricMapper(), agent.metricNameNormalizer)
      t.context.metric = metrics.getOrCreateApdexMetric(NAME)
      t.context.mapper = new MetricMapper([[{ name: NAME }, 1234]])
      t.context.metrics = metrics
    })

    t.afterEach(afterEach)

    t.test('should get the bare stats right', function (t) {
      const { metrics } = t.context
      const summary = JSON.stringify(metrics._getUnscopedData(NAME))
      t.equal(summary, '[{"name":"Agent/Test385"},[0,0,0,0.8,0.8,0]]')
      t.end()
    })

    t.test('should correctly map metrics to IDs given a mapping', function (t) {
      const { metrics, mapper } = t.context
      metrics.mapper = mapper
      const summary = JSON.stringify(metrics._getUnscopedData(NAME))
      t.equal(summary, '[1234,[0,0,0,0.8,0.8,0]]')
      t.end()
    })

    t.test('should correctly serialize statistics', function (t) {
      const { metric, metrics } = t.context
      metric.recordValueInMillis(3220)
      const summary = JSON.stringify(metrics._getUnscopedData(NAME))
      t.equal(summary, '[{"name":"Agent/Test385"},[0,0,1,0.8,0.8,0]]')
      t.end()
    })
  })

  t.test('scoped metrics', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('when serializing unscoped metrics should get the basics right', function (t) {
      const { metrics } = t.context
      metrics.measureMilliseconds('Test/Metric', null, 400, 200)
      metrics.measureMilliseconds('RenameMe333', null, 400, 300)
      metrics.measureMilliseconds('Test/ScopedMetric', 'TEST', 400, 200)

      t.equal(
        JSON.stringify(metrics._toUnscopedData()),
        '[[{"name":"Test/Metric"},[1,0.4,0.2,0.4,0.4,0.16000000000000003]],' +
          '[{"name":"RenameMe333"},[1,0.4,0.3,0.4,0.4,0.16000000000000003]]]'
      )
      t.end()
    })

    t.test('should get the basics right', function (t) {
      const { metrics } = t.context
      metrics.measureMilliseconds('Test/UnscopedMetric', null, 400, 200)
      metrics.measureMilliseconds('Test/RenameMe333', 'TEST', 400, 300)
      metrics.measureMilliseconds('Test/ScopedMetric', 'ANOTHER', 400, 200)

      t.equal(
        JSON.stringify(metrics._toScopedData()),
        '[[{"name":"Test/RenameMe333","scope":"TEST"},' +
          '[1,0.4,0.3,0.4,0.4,0.16000000000000003]],' +
          '[{"name":"Test/ScopedMetric","scope":"ANOTHER"},' +
          '[1,0.4,0.2,0.4,0.4,0.16000000000000003]]]'
      )
      t.end()
    })

    t.test('should serialize correctly', function (t) {
      const { metrics } = t.context
      metrics.measureMilliseconds('Test/UnscopedMetric', null, 400, 200)
      metrics.measureMilliseconds('Test/RenameMe333', null, 400, 300)
      metrics.measureMilliseconds('Test/ScopedMetric', 'TEST', 400, 200)

      t.equal(
        JSON.stringify(metrics.toJSON()),
        '[[{"name":"Test/UnscopedMetric"},' +
          '[1,0.4,0.2,0.4,0.4,0.16000000000000003]],' +
          '[{"name":"Test/RenameMe333"},' +
          '[1,0.4,0.3,0.4,0.4,0.16000000000000003]],' +
          '[{"name":"Test/ScopedMetric","scope":"TEST"},' +
          '[1,0.4,0.2,0.4,0.4,0.16000000000000003]]]'
      )
      t.end()
    })
  })

  t.test('when merging two metrics collections', function (t) {
    t.autoend()
    t.beforeEach(function (t) {
      beforeEach(t)
      const { metrics, agent } = t.context
      metrics.started = 31337
      metrics.measureMilliseconds('Test/Metrics/Unscoped', null, 400)
      metrics.measureMilliseconds('Test/Unscoped', null, 300)
      metrics.measureMilliseconds('Test/Scoped', 'METRICS', 200)
      metrics.measureMilliseconds('Test/Scoped', 'MERGE', 100)

      const other = new Metrics(agent.config.apdex_t, agent.mapper, agent.metricNameNormalizer)
      other.started = 1337
      other.measureMilliseconds('Test/Other/Unscoped', null, 800)
      other.measureMilliseconds('Test/Unscoped', null, 700)
      other.measureMilliseconds('Test/Scoped', 'OTHER', 600)
      other.measureMilliseconds('Test/Scoped', 'MERGE', 500)

      metrics.merge(other)
      t.context.other = other
    })

    t.afterEach(afterEach)

    t.test('has all the metrics that were only in one', function (t) {
      const { metrics } = t.context
      t.equal(metrics.getMetric('Test/Metrics/Unscoped').callCount, 1)
      t.equal(metrics.getMetric('Test/Other/Unscoped').callCount, 1)
      t.equal(metrics.getMetric('Test/Scoped', 'METRICS').callCount, 1)
      t.equal(metrics.getMetric('Test/Scoped', 'OTHER').callCount, 1)
      t.end()
    })

    t.test('merged metrics that were in both', function (t) {
      const { metrics } = t.context
      t.equal(metrics.getMetric('Test/Unscoped').callCount, 2)
      t.equal(metrics.getMetric('Test/Scoped', 'MERGE').callCount, 2)
      t.end()
    })

    t.test('does not keep the earliest creation time', function (t) {
      const { metrics } = t.context
      t.equal(metrics.started, 31337)
      t.end()
    })

    t.test('does keep the earliest creation time if told to', function (t) {
      const { metrics, other } = t.context
      metrics.merge(other, true)
      t.equal(metrics.started, 1337)
      t.end()
    })
  })

  t.test('should not let exclusive duration exceed total duration', { todo: true })
})
