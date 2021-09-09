/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

const assertMetrics = require('../lib/metrics_helper').assertMetrics
const assert = require('chai').assert
const Metrics = require('../../lib/metrics')
const MetricMapper = require('../../lib/metrics/mapper')
const MetricNormalizer = require('../../lib/metrics/normalizer')

describe('metrics_helper.assertMetrics', function () {
  let metrics

  beforeEach(function () {
    metrics = createMetricsBucket()
  })

  it('should check the args', function () {
    assert.throws(
      function () {
        assertMetrics()
      },
      Error,
      /first argument/,
      'missing first arg'
    )

    assert.throws(
      function () {
        assertMetrics([], [], true)
      },
      Error,
      /first argument/,
      'array first arg'
    )

    assert.throws(
      function () {
        assertMetrics('stuff', [], true)
      },
      Error,
      /first argument/,
      'string first arg'
    )

    assert.throws(
      function () {
        assertMetrics(metrics)
      },
      Error,
      /second argument/,
      'missing second arg'
    )

    assert.throws(
      function () {
        assertMetrics(metrics, {}, false)
      },
      Error,
      /second argument/,
      'object second arg'
    )

    assert.throws(
      function () {
        assertMetrics(metrics, 'string', true)
      },
      Error,
      /second argument/,
      'string second arg'
    )

    assert.throws(
      function () {
        assertMetrics(metrics, [])
      },
      Error,
      /third argument/,
      'missing third arg'
    )

    assert.throws(
      function () {
        assertMetrics(metrics, [], {})
      },
      Error,
      /third argument/,
      'object third arg'
    )

    assert.throws(
      function () {
        assertMetrics(metrics, [], [])
      },
      Error,
      /third argument/,
      'array third arg'
    )

    assert.doesNotThrow(function () {
      assertMetrics(metrics, [], true)
    }, 'proper args')
  })

  it('should handle unscoped metrics', function () {
    const myMetric = metrics.getOrCreateMetric('MyMetric')
    myMetric.recordValue(1, 1)
    const expected = [[{ name: 'MyMetric' }, [1, 1, 1, 1, 1, 1]]]
    assertMetrics(metrics, expected, true)
  })

  it('should handle scoped metrics', function () {
    const myMetric = metrics.getOrCreateMetric('MyMetric', 'SomeScope')
    myMetric.recordValue(1, 1)
    const expected = [[{ name: 'MyMetric', scope: 'SomeScope' }, [1, 1, 1, 1, 1, 1]]]
    assertMetrics(metrics, expected, true)
  })
})

function createMetricsBucket() {
  return new Metrics(1, new MetricMapper(), new MetricNormalizer({}, 'plain'))
}
