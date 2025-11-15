/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const sinon = require('sinon')
const MetricAggregator = require('../../../lib/metrics/metric-aggregator')
const MetricMapper = require('../../../lib/metrics/mapper')
const MetricNormalizer = require('../../../lib/metrics/normalizer')
const Metrics = require('../../../lib/metrics')

const RUN_ID = 1337
const EXPECTED_METHOD = 'metric_data'
const EXPECTED_APDEX_T = 0.1
const EXPECTED_START_SECONDS = 10
const MEGABYTE = 1024 * 1024

test('Metric Aggregator', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    ctx.nr.testClock = sinon.useFakeTimers({ now: EXPECTED_START_SECONDS * 1000 })

    const fakeCollectorApi = { send: sinon.stub() }
    const fakeHarvester = { add: sinon.stub() }

    ctx.nr.mapper = new MetricMapper()
    ctx.nr.normalizer = new MetricNormalizer({}, 'metric name')

    ctx.nr.metricAggregator = new MetricAggregator(
      {
        runId: RUN_ID,
        apdexT: EXPECTED_APDEX_T,
        mapper: ctx.nr.mapper,
        normalizer: ctx.nr.normalizer
      },
      fakeCollectorApi,
      fakeHarvester
    )
  })

  t.afterEach((ctx) => {
    const { testClock } = ctx.nr
    testClock.restore()
  })

  await t.test('should set the correct default method', (t) => {
    const { metricAggregator } = t.nr
    const method = metricAggregator.method

    assert.equal(method, EXPECTED_METHOD)
  })

  await t.test('should update runId on reconfigure', (t) => {
    const { metricAggregator } = t.nr
    const expectedRunId = 'new run id'
    const fakeConfig = { run_id: expectedRunId }

    metricAggregator.reconfigure(fakeConfig)

    assert.equal(metricAggregator.runId, expectedRunId)
  })

  await t.test('should update apdexT on reconfigure', (t) => {
    const { metricAggregator } = t.nr
    const expectedApdexT = 2000
    const fakeConfig = {
      apdex_t: expectedApdexT
    }

    metricAggregator.reconfigure(fakeConfig)

    assert.equal(metricAggregator._apdexT, expectedApdexT)
    assert.equal(metricAggregator._metrics.apdexT, expectedApdexT)
  })

  await t.test('should be true when no metrics added', (t) => {
    const { metricAggregator } = t.nr
    assert.equal(metricAggregator.empty, true)
  })

  await t.test('should be false when metrics added', (t) => {
    const { metricAggregator } = t.nr
    metricAggregator.getOrCreateMetric('myMetric')
    assert.equal(metricAggregator.empty, false)
  })

  await t.test('should reflect when new metric collection started', (t) => {
    const { metricAggregator } = t.nr
    assert.equal(metricAggregator.started, metricAggregator._metrics.started)
  })

  await t.test('_getMergeData() should return mergeable metric collection', (t) => {
    const { metricAggregator } = t.nr
    metricAggregator.getOrCreateMetric('metric1', 'scope1')
    metricAggregator.getOrCreateMetric('metric2')

    const data = metricAggregator._getMergeData()
    assert.ok(data.started)
    assert.equal(data.empty, false)

    const unscoped = data.unscoped
    assert.ok(unscoped.metric2)

    const scoped = data.scoped
    assert.ok(scoped.scope1)

    assert.ok(scoped.scope1.metric1)
  })

  await t.test('_toPayloadSync() should return json format of data', (t) => {
    const { metricAggregator, testClock } = t.nr
    const secondsToElapse = 5

    const expectedMetricName = 'myMetric'
    const expectedMetricScope = 'myScope'

    metricAggregator.getOrCreateMetric(expectedMetricName, expectedMetricScope).recordValue(22, 21)

    testClock.tick(secondsToElapse * 1000)

    const expectedEndSeconds = EXPECTED_START_SECONDS + secondsToElapse

    const payload = metricAggregator._toPayloadSync()

    assert.equal(payload.length, 4)

    const [runId, startTime, endTime, metricData] = payload

    assert.equal(runId, RUN_ID)
    assert.equal(startTime, EXPECTED_START_SECONDS)
    assert.equal(endTime, expectedEndSeconds)

    const firstMetric = metricData[0]
    assert.equal(firstMetric.length, 2)

    const [metricName, metricStats] = firstMetric

    assert.equal(metricName.name, expectedMetricName)
    assert.equal(metricName.scope, expectedMetricScope)

    // Before sending, we rely on the Stats toJSON to put in the right format
    assert.deepEqual(metricStats.toJSON(), [1, 22, 21, 22, 22, 484])
  })

  await t.test('_toPayload() should return json format of data', (t, end) => {
    const { metricAggregator, testClock } = t.nr
    const secondsToElapse = 5

    const expectedMetricName = 'myMetric'
    const expectedMetricScope = 'myScope'

    metricAggregator.getOrCreateMetric(expectedMetricName, expectedMetricScope).recordValue(22, 21)

    testClock.tick(secondsToElapse * 1000)

    const expectedEndSeconds = EXPECTED_START_SECONDS + secondsToElapse

    metricAggregator._toPayload((err, payload) => {
      assert.ifError(err)
      assert.equal(payload.length, 4)

      const [runId, startTime, endTime, metricData] = payload

      assert.equal(runId, RUN_ID)
      assert.equal(startTime, EXPECTED_START_SECONDS)
      assert.equal(endTime, expectedEndSeconds)

      const firstMetric = metricData[0]
      assert.equal(firstMetric.length, 2)

      const [metricName, metricStats] = firstMetric

      assert.equal(metricName.name, expectedMetricName)
      assert.equal(metricName.scope, expectedMetricScope)

      // Before sending, we rely on the Stats toJSON to put in the right format
      assert.deepEqual(metricStats.toJSON(), [1, 22, 21, 22, 22, 484])
      end()
    })
  })

  await t.test('_merge() should merge passed in metrics', (t) => {
    const { metricAggregator, mapper, normalizer } = t.nr
    const expectedMetricName = 'myMetric'
    const expectedMetricScope = 'myScope'

    metricAggregator.getOrCreateMetric(expectedMetricName, expectedMetricScope).recordValue(2, 1)

    const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
    mergeData.getOrCreateMetric(expectedMetricName, expectedMetricScope).recordValue(4, 2)

    mergeData.getOrCreateMetric('newMetric').incrementCallCount()

    metricAggregator._merge(mergeData)

    assert.equal(metricAggregator.empty, false)

    const newUnscopedMetric = metricAggregator.getMetric('newMetric')
    assert.equal(newUnscopedMetric.callCount, 1)

    const mergedScopedMetric = metricAggregator.getMetric(expectedMetricName, expectedMetricScope)

    assert.equal(mergedScopedMetric.callCount, 2)
    assert.equal(mergedScopedMetric.min, 2)
    assert.equal(mergedScopedMetric.max, 4)
    assert.equal(mergedScopedMetric.total, 6)
    assert.equal(mergedScopedMetric.totalExclusive, 3)
    assert.equal(mergedScopedMetric.sumOfSquares, 20)
  })

  await t.test('_merge() should choose the lowest started', (t) => {
    const { metricAggregator, mapper, normalizer } = t.nr
    metricAggregator.getOrCreateMetric('metric1').incrementCallCount()

    const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
    mergeData.getOrCreateMetric('metric2').incrementCallCount()

    // Artificially move start of merge data
    mergeData.started = metricAggregator.started - 10

    metricAggregator._merge(mergeData)

    assert.equal(metricAggregator.empty, false)

    assert.equal(metricAggregator.started, mergeData.started)
  })

  await t.test('clear() should clear metrics', (t) => {
    const { metricAggregator } = t.nr
    metricAggregator.getOrCreateMetric('metric1', 'scope1').incrementCallCount()
    metricAggregator.getOrCreateMetric('metric2').incrementCallCount()

    assert.equal(metricAggregator.empty, false)

    metricAggregator.clear()

    assert.equal(metricAggregator.empty, true)

    const metric1 = metricAggregator.getMetric('metric1', 'scope1')
    assert.ok(!metric1)

    const metric2 = metricAggregator.getMetric('metric2')
    assert.ok(!metric2)
  })

  await t.test('clear() should reset started', (t) => {
    const { metricAggregator, testClock } = t.nr
    const msToElapse = 5000

    const originalStarted = metricAggregator.started

    metricAggregator.getOrCreateMetric('metric1', 'scope1').incrementCallCount()
    metricAggregator.getOrCreateMetric('metric2').incrementCallCount()

    assert.equal(metricAggregator.empty, false)

    testClock.tick(msToElapse)

    metricAggregator.clear()

    const newStarted = metricAggregator.started

    assert.ok(newStarted > originalStarted)

    const expectedNewStarted = originalStarted + msToElapse
    assert.equal(newStarted, expectedNewStarted)
  })

  await t.test('merge() should merge passed in metrics', (t) => {
    const { metricAggregator, mapper, normalizer } = t.nr
    const expectedMetricName = 'myMetric'
    const expectedMetricScope = 'myScope'

    metricAggregator.getOrCreateMetric(expectedMetricName, expectedMetricScope).recordValue(2, 1)

    const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
    mergeData.getOrCreateMetric(expectedMetricName, expectedMetricScope).recordValue(4, 2)

    mergeData.getOrCreateMetric('newMetric').incrementCallCount()

    metricAggregator.merge(mergeData)

    assert.equal(metricAggregator.empty, false)

    const newUnscopedMetric = metricAggregator.getMetric('newMetric')
    assert.equal(newUnscopedMetric.callCount, 1)

    const mergedScopedMetric = metricAggregator.getMetric(expectedMetricName, expectedMetricScope)

    assert.equal(mergedScopedMetric.callCount, 2)
    assert.equal(mergedScopedMetric.min, 2)
    assert.equal(mergedScopedMetric.max, 4)
    assert.equal(mergedScopedMetric.total, 6)
    assert.equal(mergedScopedMetric.totalExclusive, 3)
    assert.equal(mergedScopedMetric.sumOfSquares, 20)
  })

  await t.test('merge() should not adjust start time when not passed', (t) => {
    const { metricAggregator, mapper, normalizer } = t.nr
    const originalStarted = metricAggregator.started

    metricAggregator.getOrCreateMetric('metric1').incrementCallCount()

    const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
    mergeData.getOrCreateMetric('metric2').incrementCallCount()

    // Artificially move start of merge data
    mergeData.started = metricAggregator.started - 10

    metricAggregator.merge(mergeData)

    assert.equal(metricAggregator.empty, false)

    assert.equal(metricAggregator.started, originalStarted)
  })

  await t.test('merge() should not adjust start time when adjustStartTime false', (t) => {
    const { metricAggregator, mapper, normalizer } = t.nr
    const originalStarted = metricAggregator.started

    metricAggregator.getOrCreateMetric('metric1').incrementCallCount()

    const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
    mergeData.getOrCreateMetric('metric2').incrementCallCount()

    // Artificially move start of merge data
    mergeData.started = metricAggregator.started - 10

    metricAggregator.merge(mergeData, false)

    assert.equal(metricAggregator.empty, false)

    assert.equal(metricAggregator.started, originalStarted)
  })

  await t.test('merge() should choose lowest started when adjustStartTime true', (t) => {
    const { metricAggregator, mapper, normalizer } = t.nr
    metricAggregator.getOrCreateMetric('metric1').incrementCallCount()

    const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
    mergeData.getOrCreateMetric('metric2').incrementCallCount()

    // Artificially move start of merge data
    mergeData.started = metricAggregator.started - 10

    metricAggregator.merge(mergeData, true)

    assert.equal(metricAggregator.empty, false)

    assert.equal(metricAggregator.started, mergeData.started)
  })

  await t.test('getOrCreateMetric() should return value from metrics collection', (t) => {
    const { metricAggregator } = t.nr
    const spy = sinon.spy(metricAggregator._metrics, 'getOrCreateMetric')

    const metric = metricAggregator.getOrCreateMetric('newMetric')
    metric.incrementCallCount()

    assert.equal(metric.callCount, 1)

    assert.equal(spy.calledOnce, true)
  })

  await t.test('measureMilliseconds should return value from metrics collection', (t) => {
    const { metricAggregator } = t.nr
    const spy = sinon.spy(metricAggregator._metrics, 'measureMilliseconds')

    const metric = metricAggregator.measureMilliseconds('metric', 'scope', 2000, 1000)

    assert.ok(metric)

    assert.equal(metric.callCount, 1)
    assert.equal(metric.total, 2)
    assert.equal(metric.totalExclusive, 1)

    assert.equal(spy.calledOnce, true)
  })

  await t.test('measureBytes should return value from metrics collection', (t) => {
    const { metricAggregator } = t.nr
    const spy = sinon.spy(metricAggregator._metrics, 'measureBytes')

    const metric = metricAggregator.measureBytes('metric', MEGABYTE)

    assert.ok(metric)

    assert.equal(metric.callCount, 1)
    assert.equal(metric.total, 1)
    assert.equal(metric.totalExclusive, 1)

    assert.equal(spy.calledOnce, true)
  })

  await t.test('measureBytes should record exclusive bytes', (t) => {
    const { metricAggregator } = t.nr
    const metric = metricAggregator.measureBytes('metric', MEGABYTE * 2, MEGABYTE)

    assert.ok(metric)

    assert.equal(metric.callCount, 1)
    assert.equal(metric.total, 2)
    assert.equal(metric.totalExclusive, 1)
  })

  await t.test('measureBytes should optionally not convert to megabytes', (t) => {
    const { metricAggregator } = t.nr
    const metric = metricAggregator.measureBytes('metric', 2, 1, true)

    assert.ok(metric)

    assert.equal(metric.callCount, 1)
    assert.equal(metric.total, 2)
    assert.equal(metric.totalExclusive, 1)
  })

  await t.test('getMetric() should return value from metrics collection', (t) => {
    const { metricAggregator } = t.nr
    const expectedName = 'name1'
    const expectedScope = 'scope1'

    const spy = sinon.spy(metricAggregator._metrics, 'getMetric')

    metricAggregator.getOrCreateMetric(expectedName, expectedScope).incrementCallCount()

    const metric = metricAggregator.getMetric(expectedName, expectedScope)

    assert.ok(metric)
    assert.equal(metric.callCount, 1)

    assert.equal(spy.calledOnce, true)
  })

  await t.test('getOrCreateApdexMetric() should return value from metrics collection', (t) => {
    const { metricAggregator } = t.nr
    const spy = sinon.spy(metricAggregator._metrics, 'getOrCreateApdexMetric')

    const metric = metricAggregator.getOrCreateApdexMetric('metric1', 'scope1')

    assert.equal(metric.apdexT, EXPECTED_APDEX_T)

    assert.equal(spy.calledOnce, true)
  })
})
