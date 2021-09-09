/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('chai').assert
const format = require('util').format
const urltils = require('../../lib/util/urltils')

exports.assertMetrics = assertMetrics
exports.assertSegments = assertSegments
exports.findSegment = findSegment
exports.getMetricHostName = getMetricHostName
exports.tapAssertMetrics = tapAssertMetrics

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
 */
function assertMetrics(metrics, expected, exclusive, assertValues) {
  // Assertions about arguments because maybe something returned undefined
  // unexpectedly and is passed in, or a return type changed. This will
  // hopefully help catch that and make it obvious.
  assert.isObject(metrics, 'first argument required to be an Metrics object')
  assert.isArray(expected, 'second argument required to be an array of metrics')
  assert.isBoolean(exclusive, 'third argument required to be a boolean if provided')

  if (assertValues === undefined) {
    assertValues = true
  }

  for (let i = 0, len = expected.length; i < len; i++) {
    const expectedMetric = expected[i]
    const metric = metrics.getMetric(expectedMetric[0].name, expectedMetric[0].scope)
    if (!metric) {
      throw new Error(format('%j is missing from the metrics bucket', expectedMetric[0]))
    }
    if (assertValues) {
      assert.deepEqual(
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
  }

  if (exclusive) {
    const metricsList = metrics.toJSON()
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

/**
 * @param {Test} tap                tap test object
 * @param {Transaction} transaction Nodejs agent transaction
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
 * @param {boolean} exact           When true, found and expected metric lengths should match
 */
function tapAssertMetrics(tap, transaction, expected, exact) {
  const metrics = transaction.metrics

  for (let i = 0; i < expected.length; ++i) {
    let expectedMetric = Object.assign({}, expected[i])
    let name = null
    let scope = null

    if (typeof expectedMetric === 'string') {
      name = expectedMetric
      expectedMetric = {}
    } else {
      name = expectedMetric[0].name
      scope = expectedMetric[0].scope
    }

    const metric = metrics.getMetric(name, scope)
    tap.ok(metric, 'should have expected metric name')

    tap.strictSame(metric.toJSON(), expectedMetric[1], 'metric values should match')
  }

  if (exact) {
    const metricsJSON = metrics.toJSON()
    tap.equal(metricsJSON.length, expected.length, 'metrics length should match')
  }
}

/**
 * @param {TraceSegment} parent     Parent segment
 * @param {Array} expected          Array of strings that represent segment names.
 *                                  If an item in the array is another array, it
 *                                  represents children of the previous item.
 * @param {boolean} options.exact   If true, then the expected segments must match
 *                                  exactly, including their position and children on all
 *                                  levels.  When false, then only check that each child
 *                                  exists.
 * @param {array} options.exclude   Array of segment names that should be excluded from
 *                                  validation.  This is useful, for example, when a
 *                                  segment may or may not be created by code that is not
 *                                  directly under test.  Only used when `exact` is true.
 */
function assertSegments(parent, expected, options) {
  let child
  let childCount = 0

  // rather default to what is more likely to fail than have a false test
  let exact = true
  if (options && options.exact === false) {
    exact = options.exact
  } else if (options === false) {
    exact = false
  }

  function getChildren(_parent) {
    return _parent.children.filter(function (item) {
      if (exact && options && options.exclude) {
        return options.exclude.indexOf(item.name) === -1
      }
      return true
    })
  }

  const children = getChildren(parent)
  if (exact) {
    for (let i = 0; i < expected.length; ++i) {
      const sequenceItem = expected[i]

      if (typeof sequenceItem === 'string') {
        child = children[childCount++]
        assert.equal(
          child ? child.name : undefined,
          sequenceItem,
          'segment "' +
            parent.name +
            '" should have child "' +
            sequenceItem +
            '" in position ' +
            childCount
        )

        // If the next expected item is not array, then check that the current
        // child has no children
        if (!Array.isArray(expected[i + 1])) {
          // var children = child.children
          assert(
            getChildren(child).length === 0,
            'segment "' + child.name + '" should not have any children'
          )
        }
      } else if (typeof sequenceItem === 'object') {
        assertSegments(child, sequenceItem, options)
      }
    }

    // check if correct number of children was found
    assert.equal(
      children.length,
      childCount,
      format(
        'segment "%s" expected to have %j children, but got %j',
        parent.name,
        childCount,
        children.length
      )
    )
  } else {
    for (let i = 0; i < expected.length; i++) {
      const sequenceItem = expected[i]

      if (typeof sequenceItem === 'string') {
        // find corresponding child in parent
        for (let j = 0; j < parent.children.length; j++) {
          if (parent.children[j].name === sequenceItem) {
            child = parent.children[j]
          }
        }
        assert.ok(child, 'segment "' + parent.name + '" should have child "' + sequenceItem + '"')
        if (typeof expected[i + 1] === 'object') {
          assertSegments(child, expected[i + 1], exact)
        }
      }
    }
  }
}

function findSegment(root, name) {
  if (root.name === name) {
    return root
  } else if (root.children && root.children.length) {
    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i]
      const found = findSegment(child, name)
      if (found) {
        return found
      }
    }
  }
}

function getMetricHostName(agent, host) {
  return urltils.isLocalhost(host) ? agent.config.getHostnameSafe() : host
}
