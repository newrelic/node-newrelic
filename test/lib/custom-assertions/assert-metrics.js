/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { isSimpleObject } = require('../../../lib/util/objects')

/**
 * @param {Metrics} metrics         metrics under test
 * @param {Array} expected          Array of metric data where metric data is in this form:
 *                                  [
 *                                    {
 *                                      “name”:”name of metric”,
 *                                      “scope”:”scope of metric”,
 *                                    },
 *                                    [count,
 *                                      total time,
 *                                      exclusive time,
 *                                      min time,
 *                                      max time,
 *                                      sum of squares]
 *                                  ]
 * @param {boolean} exclusive       When true, found and expected metric lengths should match
 * @param {boolean} assertValues    When true, metric values must match expected
 * @param {object} [deps] Injected dependencies.
 * @param {object} [deps.assert] Assertion library to use.
 */
module.exports = function assertMetrics(
  metrics,
  expected,
  exclusive,
  assertValues,
  { assert = require('node:assert') } = {}
) {
  // Assertions about arguments because maybe something returned undefined
  // unexpectedly and is passed in, or a return type changed. This will
  // hopefully help catch that and make it obvious.
  assert.ok(isSimpleObject(metrics), 'first argument required to be an Metrics object')
  assert.ok(Array.isArray(expected), 'second argument required to be an array of metrics')
  assert.ok(typeof exclusive === 'boolean', 'third argument required to be a boolean if provided')

  if (assertValues === undefined) {
    assertValues = true
  }

  for (let i = 0, len = expected.length; i < len; i++) {
    const expectedMetric = expected[i]
    const metric = metrics.getMetric(expectedMetric[0].name, expectedMetric[0].scope)
    assert.ok(metric, `should find ${expectedMetric[0].name}`)
    if (assertValues) {
      assert.deepEqual(metric.toJSON(), expectedMetric[1])
    }
  }

  if (exclusive) {
    const metricsList = metrics.toJSON()
    assert.equal(metricsList.length, expected.length)
  }
}
