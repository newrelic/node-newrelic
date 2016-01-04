var assertMetrics = require('../lib/metrics_helper').assertMetrics
var assert = require('chai').assert
var Metrics = require('../../lib/metrics')
var MetricMapper = require('../../lib/metrics/mapper')
var MetricNormalizer = require('../../lib/metrics/normalizer')

describe('metrics_helper.assertMetrics', function () {
  var metrics

  beforeEach(function () {
    metrics = createMetricsBucket()
  })

  it('should check the args', function () {
    assert.throws(function () {
      assertMetrics()
    }, Error, /first argument/, 'missing first arg')

    assert.throws(function () {
      assertMetrics([], [], true)
    }, Error, /first argument/, 'array first arg')

    assert.throws(function () {
      assertMetrics("stuff", [], true)
    }, Error, /first argument/, 'string first arg')

    assert.throws(function () {
      assertMetrics(metrics)
    }, Error, /second argument/, 'missing second arg')

    assert.throws(function () {
      assertMetrics(metrics, {}, false)
    }, Error, /second argument/, 'object second arg')

    assert.throws(function () {
      assertMetrics(metrics, "string", true)
    }, Error, /second argument/, 'string second arg')

    assert.throws(function () {
      assertMetrics(metrics, [])
    }, Error, /third argument/, 'missing third arg')

    assert.throws(function () {
      assertMetrics(metrics, [], {})
    }, Error, /third argument/, 'object third arg')

    assert.throws(function () {
      assertMetrics(metrics, [], [])
    }, Error, /third argument/, 'array third arg')

    assert.doesNotThrow(function () {
      assertMetrics(metrics, [], true)
    }, 'proper args')
  })

  it('should handle unscoped metrics', function () {
    var myMetric = metrics.getOrCreateMetric('MyMetric')
    myMetric.recordValue(1, 1)
    var expected = [
      [{name: "MyMetric"}, [1,1,1,1,1,1]]
    ]
    assertMetrics(metrics, expected, true)
  })

  it('should handle scoped metrics', function () {
    var myMetric = metrics.getOrCreateMetric('MyMetric', 'SomeScope')
    myMetric.recordValue(1, 1)
    var expected = [
      [{name: "MyMetric", scope: "SomeScope"}, [1,1,1,1,1,1]]
    ]
    assertMetrics(metrics, expected, true)
  })
})

function createMetricsBucket() {
  return new Metrics(1, new MetricMapper(), new MetricNormalizer({}, 'plain'))
}
