'use strict'

const expect = require('chai').expect
const sinon = require('sinon')
const MetricAggregator = require('../../../lib/metrics/metric-aggregator')
const MetricMapper = require('../../../lib/metrics/mapper')
const MetricNormalizer = require('../../../lib/metrics/normalizer')
const Metrics = require('../../../lib/metrics')

const RUN_ID = 1337
const EXPECTED_METHOD = 'metric_data'
const EXPECTED_APDEX_T = 0.1
const EXPECTED_START_SECONDS = 10

describe('Metric Aggregator', () => {
  let metricAggregator
  let fakeCollectorApi = null
  let mapper = null
  let normalizer = null
  let testClock = null

  beforeEach(() => {
    testClock = sinon.useFakeTimers({now: EXPECTED_START_SECONDS * 1000})

    fakeCollectorApi = {}
    fakeCollectorApi[EXPECTED_METHOD] = () => {}

    mapper = new MetricMapper()
    normalizer = new MetricNormalizer({}, 'metric name')

    metricAggregator = new MetricAggregator(
      {
        runId: RUN_ID,
        apdexT: EXPECTED_APDEX_T,
        mapper: mapper,
        normalizer: normalizer
      },
      fakeCollectorApi
    )
  })

  afterEach(() => {
    testClock.restore()
    testClock = null

    metricAggregator = null
    fakeCollectorApi = null
    mapper = null
    normalizer = null
  })

  it('should set the correct default method', () => {
    const method = metricAggregator.method

    expect(method).to.equal(EXPECTED_METHOD)
  })

  describe('reconfigure()', () => {
    it('should update runId', () => {
      const expectedRunId = 'new run id'
      const fakeConfig = {run_id: expectedRunId}

      metricAggregator.reconfigure(fakeConfig)

      expect(metricAggregator.runId).to.equal(expectedRunId)
    })

    it('should update apdexT', () => {
      const expectedApdexT = 2000
      const fakeConfig = {
        apdex_t: expectedApdexT
      }

      metricAggregator.reconfigure(fakeConfig)

      expect(metricAggregator._apdexT).to.equal(expectedApdexT)
      expect(metricAggregator._metrics.apdexT).to.equal(expectedApdexT)
    })
  })

  describe('empty', () => {
    it('should be true when no metrics added', () => {
      expect(metricAggregator.empty).to.be.true
    })

    it('should be false when metrics added', () => {
      metricAggregator.getOrCreateMetric('myMetric')
      expect(metricAggregator.empty).to.be.false
    })
  })

  describe('started', () => {
    it('should reflect when new metric collection started', () => {
      expect(metricAggregator.started).to.equal(metricAggregator._metrics.started)
    })
  })

  describe('_getMergeData()', () => {
    it('should return mergable metric collection', () => {
      metricAggregator.getOrCreateMetric('metric1', 'scope1')
      metricAggregator.getOrCreateMetric('metric2')

      const data = metricAggregator._getMergeData()
      expect(data).to.have.property('started')

      expect(data.empty).to.be.false

      const unscoped = data.unscoped
      expect(unscoped).to.have.property('metric2')

      const scoped = data.scoped
      expect(scoped).to.have.property('scope1')

      expect(scoped.scope1).to.have.property('metric1')
    })
  })

  describe('_toPayloadSync()', () => {
    it('should return json format of data', () => {
      const secondsToElapse = 5

      const expectedMetricName = 'myMetric'
      const expectedMetricScope = 'myScope'

      metricAggregator
        .getOrCreateMetric(expectedMetricName, expectedMetricScope)
        .recordValue(22, 21)

      testClock.tick(secondsToElapse * 1000)

      const expectedEndSeconds = EXPECTED_START_SECONDS + secondsToElapse

      const payload = metricAggregator._toPayloadSync()

      expect(payload.length).to.equal(4)

      const [runId, startTime, endTime, metricData] = payload

      expect(runId).to.equal(RUN_ID)
      expect(startTime).to.equal(EXPECTED_START_SECONDS)
      expect(endTime).to.equal(expectedEndSeconds)

      const firstMetric = metricData[0]
      expect(firstMetric.length).to.equal(2)

      const [metricName, metricStats] = firstMetric

      expect(metricName).to.have.property('name', expectedMetricName)
      expect(metricName).to.have.property('scope', expectedMetricScope)

      // Before sending, we rely on the Stats toJSON to put in the right format
      expect(metricStats.toJSON()).to.deep.equal([1, 22, 21, 22, 22, 484])
    })
  })

  describe('_toPayload()', () => {
    it('should return json format of data', () => {
      const secondsToElapse = 5

      const expectedMetricName = 'myMetric'
      const expectedMetricScope = 'myScope'

      metricAggregator
        .getOrCreateMetric(expectedMetricName, expectedMetricScope)
        .recordValue(22, 21)

      testClock.tick(secondsToElapse * 1000)

      const expectedEndSeconds = EXPECTED_START_SECONDS + secondsToElapse

      metricAggregator._toPayload((err, payload) => {
        expect(payload.length).to.equal(4)

        const [runId, startTime, endTime, metricData] = payload

        expect(runId).to.equal(RUN_ID)
        expect(startTime).to.equal(EXPECTED_START_SECONDS)
        expect(endTime).to.equal(expectedEndSeconds)

        const firstMetric = metricData[0]
        expect(firstMetric.length).to.equal(2)

        const [metricName, metricStats] = firstMetric

        expect(metricName).to.have.property('name', expectedMetricName)
        expect(metricName).to.have.property('scope', expectedMetricScope)

        // Before sending, we rely on the Stats toJSON to put in the right format
        expect(metricStats.toJSON()).to.deep.equal([1, 22, 21, 22, 22, 484])
      })
    })
  })

  describe('_merge()', () => {
    it('should merge passed in metrics', () => {
      const expectedMetricName = 'myMetric'
      const expectedMetricScope = 'myScope'

      metricAggregator
        .getOrCreateMetric(expectedMetricName, expectedMetricScope)
        .recordValue(2, 1)

      const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
      mergeData
        .getOrCreateMetric(expectedMetricName, expectedMetricScope)
        .recordValue(4, 2)

      mergeData.getOrCreateMetric('newMetric').incrementCallCount()

      metricAggregator._merge(mergeData)

      expect(metricAggregator.empty).to.be.false

      const newUnscopedMetric = metricAggregator.getMetric('newMetric')
      expect(newUnscopedMetric).to.have.property('callCount', 1)

      const mergedScopedMetric =
        metricAggregator.getMetric(expectedMetricName, expectedMetricScope)

      expect(mergedScopedMetric.callCount).to.equal(2)
      expect(mergedScopedMetric.min).to.equal(2)
      expect(mergedScopedMetric.max).to.equal(4)
      expect(mergedScopedMetric.total).to.equal(6)
      expect(mergedScopedMetric.totalExclusive).to.equal(3)
      expect(mergedScopedMetric.sumOfSquares).to.equal(20)
    })

    it('should choose the lowest started', () => {
      metricAggregator.getOrCreateMetric('metric1').incrementCallCount()

      const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
      mergeData.getOrCreateMetric('metric2').incrementCallCount()

      // Artificially move start of merge data
      mergeData.started = metricAggregator.started - 10

      metricAggregator._merge(mergeData)

      expect(metricAggregator.empty).to.be.false

      expect(metricAggregator.started).to.equal(mergeData.started)
    })
  })

  describe('clear()', () => {
    it('should clear metrics', () => {
      metricAggregator.getOrCreateMetric('metric1', 'scope1').incrementCallCount()
      metricAggregator.getOrCreateMetric('metric2').incrementCallCount()

      expect(metricAggregator.empty).to.be.false

      metricAggregator.clear()

      expect(metricAggregator.empty).to.be.true

      const metric1 = metricAggregator.getMetric('metric1', 'scope1')
      expect(metric1).to.not.exist

      const metric2 = metricAggregator.getMetric('metric2')
      expect(metric2).to.not.exist
    })

    it('should reset started', () => {
      const msToElapse = 5000

      const originalStarted = metricAggregator.started

      metricAggregator.getOrCreateMetric('metric1', 'scope1').incrementCallCount()
      metricAggregator.getOrCreateMetric('metric2').incrementCallCount()

      expect(metricAggregator.empty).to.be.false

      testClock.tick(msToElapse)

      metricAggregator.clear()

      const newStarted = metricAggregator.started

      expect(newStarted).to.be.greaterThan(originalStarted)

      const expectedNewStarted = originalStarted + msToElapse
      expect(newStarted).to.equal(expectedNewStarted)
    })
  })

  describe('merge()', () => {
    it('should merge passed in metrics', () => {
      const expectedMetricName = 'myMetric'
      const expectedMetricScope = 'myScope'

      metricAggregator
        .getOrCreateMetric(expectedMetricName, expectedMetricScope)
        .recordValue(2, 1)

      const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
      mergeData
        .getOrCreateMetric(expectedMetricName, expectedMetricScope)
        .recordValue(4, 2)

      mergeData.getOrCreateMetric('newMetric').incrementCallCount()

      metricAggregator.merge(mergeData)

      expect(metricAggregator.empty).to.be.false

      const newUnscopedMetric = metricAggregator.getMetric('newMetric')
      expect(newUnscopedMetric).to.have.property('callCount', 1)

      const mergedScopedMetric =
        metricAggregator.getMetric(expectedMetricName, expectedMetricScope)

      expect(mergedScopedMetric.callCount).to.equal(2)
      expect(mergedScopedMetric.min).to.equal(2)
      expect(mergedScopedMetric.max).to.equal(4)
      expect(mergedScopedMetric.total).to.equal(6)
      expect(mergedScopedMetric.totalExclusive).to.equal(3)
      expect(mergedScopedMetric.sumOfSquares).to.equal(20)
    })

    it('should not adjust start time when not passed', () => {
      const originalStarted = metricAggregator.started

      metricAggregator.getOrCreateMetric('metric1').incrementCallCount()

      const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
      mergeData.getOrCreateMetric('metric2').incrementCallCount()

      // Artificially move start of merge data
      mergeData.started = metricAggregator.started - 10

      metricAggregator.merge(mergeData)

      expect(metricAggregator.empty).to.be.false

      expect(metricAggregator.started).to.equal(originalStarted)
    })

    it('should not adjust start time when adjustStartTime false', () => {
      const originalStarted = metricAggregator.started

      metricAggregator.getOrCreateMetric('metric1').incrementCallCount()

      const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
      mergeData.getOrCreateMetric('metric2').incrementCallCount()

      // Artificially move start of merge data
      mergeData.started = metricAggregator.started - 10

      metricAggregator.merge(mergeData, false)

      expect(metricAggregator.empty).to.be.false

      expect(metricAggregator.started).to.equal(originalStarted)
    })

    it('should choose lowest started when adjustStartTime true', () => {
      metricAggregator.getOrCreateMetric('metric1').incrementCallCount()

      const mergeData = new Metrics(EXPECTED_APDEX_T, mapper, normalizer)
      mergeData.getOrCreateMetric('metric2').incrementCallCount()

      // Artificially move start of merge data
      mergeData.started = metricAggregator.started - 10

      metricAggregator.merge(mergeData, true)

      expect(metricAggregator.empty).to.be.false

      expect(metricAggregator.started).to.equal(mergeData.started)
    })
  })

  describe('getOrCreateMetric()', () => {
    it('should return value from metrics collection', () => {
      const spy = sinon.spy(metricAggregator._metrics, 'getOrCreateMetric')

      const metric = metricAggregator.getOrCreateMetric('newMetric')
      metric.incrementCallCount()

      expect(metric).to.have.property('callCount', 1)

      expect(spy.calledOnce).to.be.true
    })
  })

  describe('measureMilliseconds', () => {
    it('should return value from metrics collection', () => {
      const spy = sinon.spy(metricAggregator._metrics, 'measureMilliseconds')

      const metric = metricAggregator.measureMilliseconds('metric', 'scope', 2000, 1000)

      expect(metric).to.exist

      expect(metric).to.have.property('callCount', 1)
      expect(metric).to.have.property('total', 2)
      expect(metric).to.have.property('totalExclusive', 1)

      expect(spy.calledOnce).to.be.true
    })
  })

  describe('measureBytes', () => {
    it('should return value from metrics collection', () => {
      const spy = sinon.spy(metricAggregator._metrics, 'measureBytes')

      const metric = metricAggregator.measureBytes('metric', 1024 * 1024)

      expect(metric).to.exist

      expect(metric).to.have.property('callCount', 1)
      expect(metric).to.have.property('total', 1)
      expect(metric).to.have.property('totalExclusive', 1)

      expect(spy.calledOnce).to.be.true
    })
  })

  describe('getMetric()', () => {
    it('should return value from metrics collection', () => {
      const expectedName = 'name1'
      const expectedScope = 'scope1'

      const spy = sinon.spy(metricAggregator._metrics, 'getMetric')

      metricAggregator
        .getOrCreateMetric(expectedName, expectedScope)
        .incrementCallCount()

      const metric = metricAggregator.getMetric(expectedName, expectedScope)

      expect(metric).to.exist
      expect(metric).to.have.property('callCount', 1)

      expect(spy.calledOnce).to.be.true
    })
  })

  describe('getOrCreateApdexMetric()', () => {
    it('should return value from metrics collection', () => {
      const spy = sinon.spy(metricAggregator._metrics, 'getOrCreateApdexMetric')

      const metric = metricAggregator.getOrCreateApdexMetric('metric1', 'scope1')

      expect(metric).to.have.property('apdexT', EXPECTED_APDEX_T)

      expect(spy.calledOnce).to.be.true
    })
  })
})
