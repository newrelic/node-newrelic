/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
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

tap.test('Metric Aggregator', (t) => {
  t.beforeEach((t) => {
    t.context.testClock = sinon.useFakeTimers({ now: EXPECTED_START_SECONDS * 1000 })

    const fakeCollectorApi = { send: sinon.stub() }
    const fakeHarvester = { add: sinon.stub() }

    t.context.mapper = new MetricMapper()
    t.context.normalizer = new MetricNormalizer({}, 'metric name')

    t.context.metricAggregator = new MetricAggregator(
      {
        runId: RUN_ID,
        apdexT: EXPECTED_APDEX_T,
        mapper: t.context.mapper,
        normalizer: t.context.normalizer
      },
      fakeCollectorApi,
      fakeHarvester
    )
  })

  t.afterEach((t) => {
    const { testClock } = t.context
    testClock.restore()
  })

  t.test('should set the correct default method', (t) => {
    const { metricAggregator } = t.context
    const method = metricAggregator.method

    t.equal(method, EXPECTED_METHOD)
    t.end()
  })

  t.test('should update runId on reconfigure', (t) => {
    const { metricAggregator } = t.context
    const expectedRunId = 'new run id'
    const fakeConfig = { run_id: expectedRunId }

    metricAggregator.reconfigure(fakeConfig)

    t.equal(metricAggregator.runId, expectedRunId)
    t.end()
  })

  t.test('should update apdexT on reconfigure', (t) => {
    const { metricAggregator } = t.context
    const expectedApdexT = 2000
    const fakeConfig = {
      apdex_t: expectedApdexT
    }

    metricAggregator.reconfigure(fakeConfig)

    t.equal(metricAggregator._apdexT, expectedApdexT)
    t.equal(metricAggregator._metrics.apdexT, expectedApdexT)
    t.end()
  })

  t.test('should be true when no metrics added', (t) => {
    const { metricAggregator } = t.context
    t.equal(metricAggregator.empty, true)
    t.end()
  })

  t.test('should be false when metrics added', (t) => {
    const { metricAggregator } = t.context
    metricAggregator.getOrCreateMetric('myMetric')
    t.equal(metricAggregator.empty, false)
    t.end()
  })

  t.test('should reflect when new metric collection started', (t) => {
    const { metricAggregator } = t.context
    t.equal(metricAggregator.started, metricAggregator._metrics.started)
    t.end()
  })

  t.test('_getMergeData() should return mergable metric collection', (t) => {
    const { metricAggregator } = t.context
    metricAggregator.getOrCreateMetric('metric1', 'scope1')
    metricAggregator.getOrCreateMetric('metric2')

    const data = metricAggregator._getMergeData()
    t.ok(data.started)
    t.equal(data.empty, false)

    const unscoped = data.unscoped
    t.ok(unscoped.metric2)

    const scoped = data.scoped
    t.ok(scoped.scope1)

    t.ok(scoped.scope1.metric1)
    t.end()
  })

  t.test('_toPayloadSync() should return json format of data', (t) => {
    const { metricAggregator, testClock } = t.context
    const secondsToElapse = 5

    const expectedMetricName = 'myMetric'
    const expectedMetricScope = 'myScope'

    metricAggregator.getOrCreateMetric(expectedMetricName, expectedMetricScope).recordValue(22, 21)

    testClock.tick(secondsToElapse * 1000)

    const expectedEndSeconds = EXPECTED_START_SECONDS + secondsToElapse

    const payload = metricAggregator._toPayloadSync()

    t.equal(payload.length, 4)

    const [runId, startTime, endTime, metricData] = payload

    t.equal(runId, RUN_ID)
    t.equal(startTime, EXPECTED_START_SECONDS)
    t.equal(endTime, expectedEndSeconds)

    const firstMetric = metricData[0]
    t.equal(firstMetric.length, 2)

    const [metricName, metricStats] = firstMetric

    t.equal(metricName.name, expectedMetricName)
    t.equal(metricName.scope, expectedMetricScope)

    // Before sending, we rely on the Stats toJSON to put in the right format
    t.same(metricStats.toJSON(), [1, 22, 21, 22, 22, 484])
    t.end()
  })

  t.test('_toPayload() should return json format of data', (t) => {
    const { metricAggregator, testClock } = t.context
    const secondsToElapse = 5

    const expectedMetricName = 'myMetric'
    const expectedMetricScope = 'myScope'

    metricAggregator.getOrCreateMetric(expectedMetricName, expectedMetricScope).recordValue(22, 21)

    testClock.tick(secondsToElapse * 1000)

    const expectedEndSeconds = EXPECTED_START_SECONDS + secondsToElapse

    metricAggregator._toPayload((err, payload) => {
      t.equal(payload.length, 4)

      const [runId, startTime, endTime, metricData] = payload

      t.equal(runId, RUN_ID)
      t.equal(startTime, EXPECTED_START_SECONDS)
      t.equal(endTime, expectedEndSeconds)

      const firstMetric = metricData[0]
      t.equal(firstMetric.length, 2)

      const [metricName, metricStats] = firstMetric

      t.equal(metricName.name, expectedMetricName)
      t.equal(metricName.scope, expectedMetricScope)

      // Before sending, we rely on the Stats toJSON to put in the right format
      t.same(metricStats.toJSON(), [1, 22, 21, 22, 22, 484])
      t.end()
    })
  })

  t.test('_merge() should merge passed in metrics', (t) => {
    const { metricAggregator, mapper, normalizer } = t.context
    const expectedMetricName = 'myMetric'
    const expectedMetricScope = 'myScope'

    metricAggregator.getOrCreateMetric(expectedMetricName, expectedMetricScope).recordValue(2, 1)

    const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
    mergeData.getOrCreateMetric(expectedMetricName, expectedMetricScope).recordValue(4, 2)

    mergeData.getOrCreateMetric('newMetric').incrementCallCount()

    metricAggregator._merge(mergeData)

    t.equal(metricAggregator.empty, false)

    const newUnscopedMetric = metricAggregator.getMetric('newMetric')
    t.equal(newUnscopedMetric.callCount, 1)

    const mergedScopedMetric = metricAggregator.getMetric(expectedMetricName, expectedMetricScope)

    t.equal(mergedScopedMetric.callCount, 2)
    t.equal(mergedScopedMetric.min, 2)
    t.equal(mergedScopedMetric.max, 4)
    t.equal(mergedScopedMetric.total, 6)
    t.equal(mergedScopedMetric.totalExclusive, 3)
    t.equal(mergedScopedMetric.sumOfSquares, 20)
    t.end()
  })

  t.test('_merge() should choose the lowest started', (t) => {
    const { metricAggregator, mapper, normalizer } = t.context
    metricAggregator.getOrCreateMetric('metric1').incrementCallCount()

    const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
    mergeData.getOrCreateMetric('metric2').incrementCallCount()

    // Artificially move start of merge data
    mergeData.started = metricAggregator.started - 10

    metricAggregator._merge(mergeData)

    t.equal(metricAggregator.empty, false)

    t.equal(metricAggregator.started, mergeData.started)
    t.end()
  })

  t.test('clear() should clear metrics', (t) => {
    const { metricAggregator } = t.context
    metricAggregator.getOrCreateMetric('metric1', 'scope1').incrementCallCount()
    metricAggregator.getOrCreateMetric('metric2').incrementCallCount()

    t.equal(metricAggregator.empty, false)

    metricAggregator.clear()

    t.equal(metricAggregator.empty, true)

    const metric1 = metricAggregator.getMetric('metric1', 'scope1')
    t.notOk(metric1)

    const metric2 = metricAggregator.getMetric('metric2')
    t.notOk(metric2)
    t.end()
  })

  t.test('clear() should reset started', (t) => {
    const { metricAggregator, testClock } = t.context
    const msToElapse = 5000

    const originalStarted = metricAggregator.started

    metricAggregator.getOrCreateMetric('metric1', 'scope1').incrementCallCount()
    metricAggregator.getOrCreateMetric('metric2').incrementCallCount()

    t.equal(metricAggregator.empty, false)

    testClock.tick(msToElapse)

    metricAggregator.clear()

    const newStarted = metricAggregator.started

    t.ok(newStarted > originalStarted)

    const expectedNewStarted = originalStarted + msToElapse
    t.equal(newStarted, expectedNewStarted)
    t.end()
  })

  t.test('merge() should merge passed in metrics', (t) => {
    const { metricAggregator, mapper, normalizer } = t.context
    const expectedMetricName = 'myMetric'
    const expectedMetricScope = 'myScope'

    metricAggregator.getOrCreateMetric(expectedMetricName, expectedMetricScope).recordValue(2, 1)

    const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
    mergeData.getOrCreateMetric(expectedMetricName, expectedMetricScope).recordValue(4, 2)

    mergeData.getOrCreateMetric('newMetric').incrementCallCount()

    metricAggregator.merge(mergeData)

    t.equal(metricAggregator.empty, false)

    const newUnscopedMetric = metricAggregator.getMetric('newMetric')
    t.equal(newUnscopedMetric.callCount, 1)

    const mergedScopedMetric = metricAggregator.getMetric(expectedMetricName, expectedMetricScope)

    t.equal(mergedScopedMetric.callCount, 2)
    t.equal(mergedScopedMetric.min, 2)
    t.equal(mergedScopedMetric.max, 4)
    t.equal(mergedScopedMetric.total, 6)
    t.equal(mergedScopedMetric.totalExclusive, 3)
    t.equal(mergedScopedMetric.sumOfSquares, 20)
    t.end()
  })

  t.test('merge() should not adjust start time when not passed', (t) => {
    const { metricAggregator, mapper, normalizer } = t.context
    const originalStarted = metricAggregator.started

    metricAggregator.getOrCreateMetric('metric1').incrementCallCount()

    const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
    mergeData.getOrCreateMetric('metric2').incrementCallCount()

    // Artificially move start of merge data
    mergeData.started = metricAggregator.started - 10

    metricAggregator.merge(mergeData)

    t.equal(metricAggregator.empty, false)

    t.equal(metricAggregator.started, originalStarted)
    t.end()
  })

  t.test('merge() should not adjust start time when adjustStartTime false', (t) => {
    const { metricAggregator, mapper, normalizer } = t.context
    const originalStarted = metricAggregator.started

    metricAggregator.getOrCreateMetric('metric1').incrementCallCount()

    const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
    mergeData.getOrCreateMetric('metric2').incrementCallCount()

    // Artificially move start of merge data
    mergeData.started = metricAggregator.started - 10

    metricAggregator.merge(mergeData, false)

    t.equal(metricAggregator.empty, false)

    t.equal(metricAggregator.started, originalStarted)
    t.end()
  })

  t.test('merge() should choose lowest started when adjustStartTime true', (t) => {
    const { metricAggregator, mapper, normalizer } = t.context
    metricAggregator.getOrCreateMetric('metric1').incrementCallCount()

    const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
    mergeData.getOrCreateMetric('metric2').incrementCallCount()

    // Artificially move start of merge data
    mergeData.started = metricAggregator.started - 10

    metricAggregator.merge(mergeData, true)

    t.equal(metricAggregator.empty, false)

    t.equal(metricAggregator.started, mergeData.started)
    t.end()
  })

  t.test('getOrCreateMetric() should return value from metrics collection', (t) => {
    const { metricAggregator } = t.context
    const spy = sinon.spy(metricAggregator._metrics, 'getOrCreateMetric')

    const metric = metricAggregator.getOrCreateMetric('newMetric')
    metric.incrementCallCount()

    t.equal(metric.callCount, 1)

    t.equal(spy.calledOnce, true)
    t.end()
  })

  t.test('measureMilliseconds should return value from metrics collection', (t) => {
    const { metricAggregator } = t.context
    const spy = sinon.spy(metricAggregator._metrics, 'measureMilliseconds')

    const metric = metricAggregator.measureMilliseconds('metric', 'scope', 2000, 1000)

    t.ok(metric)

    t.equal(metric.callCount, 1)
    t.equal(metric.total, 2)
    t.equal(metric.totalExclusive, 1)

    t.equal(spy.calledOnce, true)
    t.end()
  })

  t.test('measureBytes should return value from metrics collection', (t) => {
    const { metricAggregator } = t.context
    const spy = sinon.spy(metricAggregator._metrics, 'measureBytes')

    const metric = metricAggregator.measureBytes('metric', MEGABYTE)

    t.ok(metric)

    t.equal(metric.callCount, 1)
    t.equal(metric.total, 1)
    t.equal(metric.totalExclusive, 1)

    t.equal(spy.calledOnce, true)
    t.end()
  })

  t.test('measureBytes should record exclusive bytes', (t) => {
    const { metricAggregator } = t.context
    const metric = metricAggregator.measureBytes('metric', MEGABYTE * 2, MEGABYTE)

    t.ok(metric)

    t.equal(metric.callCount, 1)
    t.equal(metric.total, 2)
    t.equal(metric.totalExclusive, 1)
    t.end()
  })

  t.test('measureBytes should optionally not convert to megabytes', (t) => {
    const { metricAggregator } = t.context
    const metric = metricAggregator.measureBytes('metric', 2, 1, true)

    t.ok(metric)

    t.equal(metric.callCount, 1)
    t.equal(metric.total, 2)
    t.equal(metric.totalExclusive, 1)
    t.end()
  })

  t.test('getMetric() should return value from metrics collection', (t) => {
    const { metricAggregator } = t.context
    const expectedName = 'name1'
    const expectedScope = 'scope1'

    const spy = sinon.spy(metricAggregator._metrics, 'getMetric')

    metricAggregator.getOrCreateMetric(expectedName, expectedScope).incrementCallCount()

    const metric = metricAggregator.getMetric(expectedName, expectedScope)

    t.ok(metric)
    t.equal(metric.callCount, 1)

    t.equal(spy.calledOnce, true)
    t.end()
  })

  t.test('getOrCreateApdexMetric() should return value from metrics collection', (t) => {
    const { metricAggregator } = t.context
    const spy = sinon.spy(metricAggregator._metrics, 'getOrCreateApdexMetric')

    const metric = metricAggregator.getOrCreateApdexMetric('metric1', 'scope1')

    t.equal(metric.apdexT, EXPECTED_APDEX_T)

    t.equal(spy.calledOnce, true)
    t.end()
  })
  t.end()
})
