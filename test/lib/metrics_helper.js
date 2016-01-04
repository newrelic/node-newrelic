var assert = require('chai').assert
var format = require('util').format

exports.assertMetrics = function assertMetrics(metrics, expected, exclusive) {
  // Assertions about arguments because maybe something returned undefined
  // unexpectedly and is passed in, or a return type changed. This will
  // hopefully help catch that and make it obvious.
  assert.isObject(metrics, 'first argument required to be an Metrics object')
  assert.isArray(expected, 'second argument required to be an array of metrics')
  assert.isBoolean(exclusive, 'third argument required to be a boolean if provided')

  for (var i = 0, len = expected.length; i < len; i++) {
    var expectedMetric = expected[i]
    var metric = metrics.getMetric(
      expectedMetric[0].name,
      expectedMetric[0].scope
    )
    if (!metric) {
      throw new Error(format('%j is missing from the metrics bucket', expectedMetric[0]))
    }
    assert.sameMembers(
      metric.toJSON(),
      expectedMetric[1],
      format(
        '%j did not match (got %j, expected: %j)',
        expectedMetric[0],
        metric.toJSON(),
        expectedMetric[1]
      )
    )
  }

  if (exclusive) {
    var metricsList = metrics.toJSON()
    assert.equal(
      metricsList.length,
      expected.length,
      format(
        'exclusive set expected but there is a length mismatch (got: %j, expected %j)',
        metricsList,
        expected
      )
    )
  }
}
