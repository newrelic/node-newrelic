/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const Metrics = require('../../../lib/metrics')
const MetricMapper = require('../../../lib/metrics/mapper')
const MetricNormalizer = require('../../../lib/metrics/normalizer')

function beforeEach(ctx) {
  ctx.nr = {}
  const agent = helper.loadMockedAgent()
  ctx.nr.metrics = new Metrics(agent.config.apdex_t, agent.mapper, agent.metricNameNormalizer)
  ctx.nr.agent = agent
}

function afterEach(ctx) {
  helper.unloadAgent(ctx.nr.agent)
}

test('Metrics', async function (t) {
  await t.test('when creating', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should throw if apdexT is not set', function (t, end) {
      const { agent } = t.nr
      assert.throws(function () {
        // eslint-disable-next-line no-new
        new Metrics(undefined, agent.mapper, agent.metricNameNormalizer)
      })
      end()
    })

    await t.test('should throw if no name -> ID mapper is provided', function (t, end) {
      const { agent } = t.nr
      assert.throws(function () {
        // eslint-disable-next-line no-new
        new Metrics(agent.config.apdex_t, undefined, agent.metricNameNormalizer)
      })
      end()
    })

    await t.test('should throw if no metric name normalizer is provided', function (t, end) {
      const { agent } = t.nr
      assert.throws(function () {
        // eslint-disable-next-line no-new
        new Metrics(agent.config.apdex_t, agent.mapper, undefined)
      })
      end()
    })

    await t.test('should return apdex summaries with an apdexT same as config', function (t, end) {
      const { metrics, agent } = t.nr
      const metric = metrics.getOrCreateApdexMetric('Apdex/MetricsTest')
      assert.equal(metric.apdexT, agent.config.apdex_t)
      end()
    })

    await t.test('should allow overriding apdex summaries with a custom apdexT', function (t, end) {
      const { metrics } = t.nr
      const metric = metrics.getOrCreateApdexMetric('Apdex/MetricsTest', null, 1)
      assert.equal(metric.apdexT, 0.001)
      end()
    })

    await t.test('should require the overriding apdex to be greater than 0', function (t, end) {
      const { metrics, agent } = t.nr
      const metric = metrics.getOrCreateApdexMetric('Apdex/MetricsTest', null, 0)
      assert.equal(metric.apdexT, agent.config.apdex_t)
      end()
    })

    await t.test('should require the overriding apdex to not be negative', function (t, end) {
      const { metrics, agent } = t.nr
      const metric = metrics.getOrCreateApdexMetric('Apdex/MetricsTest', null, -5000)
      assert.equal(metric.apdexT, agent.config.apdex_t)
      end()
    })

    await t.test(
      'when creating individual apdex metrics should have apdex functions',
      function (t, end) {
        const { metrics } = t.nr
        const metric = metrics.getOrCreateApdexMetric('Agent/ApdexTest')
        assert.ok(metric.incrementFrustrating)
        end()
      }
    )

    await t.test('should measure an unscoped metric', function (t, end) {
      const { metrics } = t.nr
      metrics.measureMilliseconds('Test/Metric', null, 400, 200)
      assert.equal(
        JSON.stringify(metrics.toJSON()),
        '[[{"name":"Test/Metric"},[1,0.4,0.2,0.4,0.4,0.16000000000000003]]]'
      )
      end()
    })

    await t.test('should measure a scoped metric', function (t, end) {
      const { metrics } = t.nr
      metrics.measureMilliseconds('T/M', 'T', 400, 200)
      assert.equal(
        JSON.stringify(metrics.toJSON()),
        '[[{"name":"T/M","scope":"T"},[1,0.4,0.2,0.4,0.4,0.16000000000000003]]]'
      )
      end()
    })

    await t.test(
      'should resolve the correctly scoped set of metrics when scope passed',
      function (t, end) {
        const { metrics } = t.nr
        metrics.measureMilliseconds('Apdex/ScopedMetricsTest', 'TEST')
        const scoped = metrics._resolve('TEST')

        assert.ok(scoped['Apdex/ScopedMetricsTest'])
        end()
      }
    )

    await t.test(
      'should implicitly create a blank set of metrics when resolving new scope',
      (t, end) => {
        const { metrics } = t.nr
        const scoped = metrics._resolve('NOEXISTBRO')

        assert.ok(scoped)
        assert.equal(Object.keys(scoped).length, 0)
        end()
      }
    )

    await t.test(
      'should return a preëxisting unscoped metric when it is requested',
      function (t, end) {
        const { metrics } = t.nr
        metrics.measureMilliseconds('Test/UnscopedMetric', null, 400, 200)
        assert.equal(metrics.getOrCreateMetric('Test/UnscopedMetric').callCount, 1)
        end()
      }
    )

    await t.test(
      'should return a preëxisting scoped metric when it is requested',
      function (t, end) {
        const { metrics } = t.nr
        metrics.measureMilliseconds('Test/Metric', 'TEST', 400, 200)
        assert.equal(metrics.getOrCreateMetric('Test/Metric', 'TEST').callCount, 1)
        end()
      }
    )

    await t.test('should return the unscoped metrics when scope not set', function (t, end) {
      const { metrics } = t.nr
      metrics.measureMilliseconds('Test/UnscopedMetric', null, 400, 200)
      assert.equal(Object.keys(metrics._resolve()).length, 1)
      assert.equal(Object.keys(metrics.scoped).length, 0)
      end()
    })

    await t.test('should measure bytes ok', function (t, end) {
      const { metrics } = t.nr
      const MEGABYTE = 1024 * 1024
      const stat = metrics.measureBytes('Test/Bytes', MEGABYTE)
      assert.equal(stat.total, 1)
      assert.equal(stat.totalExclusive, 1)
      end()
    })

    await t.test('should measure exclusive bytes ok', function (t, end) {
      const { metrics } = t.nr
      const MEGABYTE = 1024 * 1024
      const stat = metrics.measureBytes('Test/Bytes', MEGABYTE * 2, MEGABYTE)
      assert.equal(stat.total, 2)
      assert.equal(stat.totalExclusive, 1)
      end()
    })

    await t.test('should optionally not convert bytes to megabytes', function (t, end) {
      const { metrics } = t.nr
      const MEGABYTE = 1024 * 1024
      const stat = metrics.measureBytes('Test/Bytes', MEGABYTE * 2, MEGABYTE, true)
      assert.equal(stat.total, MEGABYTE * 2)
      assert.equal(stat.totalExclusive, MEGABYTE)
      end()
    })
  })

  await t.test('when creating individual metrics', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should create a metric when a nonexistent name is requested', function (t, end) {
      const { metrics } = t.nr
      const metric = metrics.getOrCreateMetric('Test/Nonexistent', 'TEST')
      assert.equal(metric.callCount, 0)
      end()
    })

    await t.test('should have statistics available', function (t, end) {
      const { metrics } = t.nr
      const metric = metrics.getOrCreateMetric('Agent/Test')
      assert.equal(metric.callCount, 0)
      end()
    })

    await t.test('should have have regular functions', function (t, end) {
      const { metrics } = t.nr
      const metric = metrics.getOrCreateMetric('Agent/StatsTest')
      assert.equal(metric.callCount, 0)
      end()
    })
  })

  await t.test('when creating with parameters', async function (t) {
    const TEST_APDEX = 0.4
    const TEST_MAPPER = new MetricMapper([[{ name: 'Renamed/333' }, 1337]])
    const TEST_NORMALIZER = new MetricNormalizer({ enforce_backstop: true }, 'metric name')

    t.beforeEach(function (t) {
      beforeEach(t)
      TEST_NORMALIZER.addSimple(/^Test\/RenameMe(.*)$/, 'Renamed/$1')
      t.nr.metrics = new Metrics(TEST_APDEX, TEST_MAPPER, TEST_NORMALIZER)
    })

    t.afterEach(afterEach)

    await t.test('should pass apdex through to ApdexStats', function (t, end) {
      const { metrics } = t.nr
      const apdex = metrics.getOrCreateApdexMetric('Test/RenameMe333')
      assert.equal(apdex.apdexT, TEST_APDEX)
      end()
    })

    await t.test('should pass metric mappings through for serialization', function (t, end) {
      const { metrics } = t.nr
      metrics.measureMilliseconds('Test/RenameMe333', null, 400, 300)
      const summary = JSON.stringify(metrics.toJSON())
      assert.equal(summary, '[[1337,[1,0.4,0.3,0.4,0.4,0.16000000000000003]]]')
      end()
    })
  })

  await t.test('with ordinary statistics', async function (t) {
    const NAME = 'Agent/Test384'

    t.beforeEach(function (t) {
      beforeEach(t)
      const metric = t.nr.metrics.getOrCreateMetric(NAME)
      const mapper = new MetricMapper([[{ name: NAME }, 1234]])
      t.nr.metric = metric
      t.nr.mapper = mapper
    })

    t.afterEach(afterEach)

    await t.test('should get the bare stats right', function (t, end) {
      const { metrics } = t.nr
      const summary = JSON.stringify(metrics._getUnscopedData(NAME))
      assert.equal(summary, '[{"name":"Agent/Test384"},[0,0,0,0,0,0]]')
      end()
    })

    await t.test('should correctly map metrics to IDs given a mapping', function (t, end) {
      const { metrics, mapper } = t.nr
      metrics.mapper = mapper
      const summary = JSON.stringify(metrics._getUnscopedData(NAME))
      assert.equal(summary, '[1234,[0,0,0,0,0,0]]')
      end()
    })

    await t.test('should correctly serialize statistics', function (t, end) {
      const { metrics, metric } = t.nr
      metric.recordValue(0.3, 0.1)
      const summary = JSON.stringify(metrics._getUnscopedData(NAME))
      assert.equal(summary, '[{"name":"Agent/Test384"},[1,0.3,0.1,0.3,0.3,0.09]]')
      end()
    })
  })

  await t.test('with apdex statistics', async function (t) {
    const NAME = 'Agent/Test385'
    t.beforeEach(function (t) {
      beforeEach(t)
      const { agent } = t.nr
      const metrics = new Metrics(0.8, new MetricMapper(), agent.metricNameNormalizer)
      t.nr.metric = metrics.getOrCreateApdexMetric(NAME)
      t.nr.mapper = new MetricMapper([[{ name: NAME }, 1234]])
      t.nr.metrics = metrics
    })

    t.afterEach(afterEach)

    await t.test('should get the bare stats right', function (t, end) {
      const { metrics } = t.nr
      const summary = JSON.stringify(metrics._getUnscopedData(NAME))
      assert.equal(summary, '[{"name":"Agent/Test385"},[0,0,0,0.8,0.8,0]]')
      end()
    })

    await t.test('should correctly map metrics to IDs given a mapping', function (t, end) {
      const { metrics, mapper } = t.nr
      metrics.mapper = mapper
      const summary = JSON.stringify(metrics._getUnscopedData(NAME))
      assert.equal(summary, '[1234,[0,0,0,0.8,0.8,0]]')
      end()
    })

    await t.test('should correctly serialize statistics', function (t, end) {
      const { metric, metrics } = t.nr
      metric.recordValueInMillis(3220)
      const summary = JSON.stringify(metrics._getUnscopedData(NAME))
      assert.equal(summary, '[{"name":"Agent/Test385"},[0,0,1,0.8,0.8,0]]')
      end()
    })
  })

  await t.test('scoped metrics', async function (t) {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test(
      'when serializing unscoped metrics should get the basics right',
      function (t, end) {
        const { metrics } = t.nr
        metrics.measureMilliseconds('Test/Metric', null, 400, 200)
        metrics.measureMilliseconds('RenameMe333', null, 400, 300)
        metrics.measureMilliseconds('Test/ScopedMetric', 'TEST', 400, 200)

        assert.equal(
          JSON.stringify(metrics._toUnscopedData()),
          '[[{"name":"Test/Metric"},[1,0.4,0.2,0.4,0.4,0.16000000000000003]],' +
            '[{"name":"RenameMe333"},[1,0.4,0.3,0.4,0.4,0.16000000000000003]]]'
        )
        end()
      }
    )

    await t.test('should get the basics right', function (t, end) {
      const { metrics } = t.nr
      metrics.measureMilliseconds('Test/UnscopedMetric', null, 400, 200)
      metrics.measureMilliseconds('Test/RenameMe333', 'TEST', 400, 300)
      metrics.measureMilliseconds('Test/ScopedMetric', 'ANOTHER', 400, 200)

      assert.equal(
        JSON.stringify(metrics._toScopedData()),
        '[[{"name":"Test/RenameMe333","scope":"TEST"},' +
          '[1,0.4,0.3,0.4,0.4,0.16000000000000003]],' +
          '[{"name":"Test/ScopedMetric","scope":"ANOTHER"},' +
          '[1,0.4,0.2,0.4,0.4,0.16000000000000003]]]'
      )
      end()
    })

    await t.test('should serialize correctly', function (t, end) {
      const { metrics } = t.nr
      metrics.measureMilliseconds('Test/UnscopedMetric', null, 400, 200)
      metrics.measureMilliseconds('Test/RenameMe333', null, 400, 300)
      metrics.measureMilliseconds('Test/ScopedMetric', 'TEST', 400, 200)

      assert.equal(
        JSON.stringify(metrics.toJSON()),
        '[[{"name":"Test/UnscopedMetric"},' +
          '[1,0.4,0.2,0.4,0.4,0.16000000000000003]],' +
          '[{"name":"Test/RenameMe333"},' +
          '[1,0.4,0.3,0.4,0.4,0.16000000000000003]],' +
          '[{"name":"Test/ScopedMetric","scope":"TEST"},' +
          '[1,0.4,0.2,0.4,0.4,0.16000000000000003]]]'
      )
      end()
    })
  })

  await t.test('when merging two metrics collections', async function (t) {
    t.beforeEach(function (t) {
      beforeEach(t)
      const { metrics, agent } = t.nr
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
      t.nr.other = other
    })

    t.afterEach(afterEach)

    await t.test('has all the metrics that were only in one', function (t, end) {
      const { metrics } = t.nr
      assert.equal(metrics.getMetric('Test/Metrics/Unscoped').callCount, 1)
      assert.equal(metrics.getMetric('Test/Other/Unscoped').callCount, 1)
      assert.equal(metrics.getMetric('Test/Scoped', 'METRICS').callCount, 1)
      assert.equal(metrics.getMetric('Test/Scoped', 'OTHER').callCount, 1)
      end()
    })

    await t.test('merged metrics that were in both', function (t, end) {
      const { metrics } = t.nr
      assert.equal(metrics.getMetric('Test/Unscoped').callCount, 2)
      assert.equal(metrics.getMetric('Test/Scoped', 'MERGE').callCount, 2)
      end()
    })

    await t.test('does not keep the earliest creation time', function (t, end) {
      const { metrics } = t.nr
      assert.equal(metrics.started, 31337)
      end()
    })

    await t.test('does keep the earliest creation time if told to', function (t, end) {
      const { metrics, other } = t.nr
      metrics.merge(other, true)
      assert.equal(metrics.started, 1337)
      end()
    })
  })

  await t.test('should not let exclusive duration exceed total duration', { todo: true })
})
