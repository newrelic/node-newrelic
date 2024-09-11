/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const { isSimpleObject } = require('../../lib/util/objects')

function assertExactClmAttrs(segmentStub, expectedAttrs) {
  const attrs = segmentStub.addAttribute.args
  const attrsObj = attrs.reduce((obj, [key, value]) => {
    obj[key] = value
    return obj
  }, {})
  assert.deepEqual(attrsObj, expectedAttrs, 'CLM attrs should match')
}

/**
 * Asserts the appropriate Code Level Metrics attributes on a segment
 *
 * @param {object} params
 * @param {object} params.segments list of segments to assert { segment, filepath, name }
 * @param {boolean} params.enabled if CLM is enabled or not
 * @param {boolean} params.skipFull flag to skip asserting `code.lineno` and `code.column`
 */
function assertCLMAttrs({ segments, enabled: clmEnabled, skipFull = false }) {
  segments.forEach((segment) => {
    const attrs = segment.segment.getAttributes()
    if (clmEnabled) {
      assert.equal(attrs['code.function'], segment.name, 'should have appropriate code.function')
      assert.ok(
        attrs['code.filepath'].endsWith(segment.filepath),
        'should have appropriate code.filepath'
      )

      if (!skipFull) {
        assert.equal(typeof attrs['code.lineno'], 'number', 'lineno should be a number')
        assert.equal(typeof attrs['code.column'], 'number', 'column should be a number')
      }
    } else {
      assert.ok(!attrs['code.function'], 'function should not exist')
      assert.ok(!attrs['code.filepath'], 'filepath should not exist')
      assert.ok(!attrs['code.lineno'], 'lineno should not exist')
      assert.ok(!attrs['code.column'], 'column should not exist')
    }
  })
}

/**
 * assertion to test if a property is non-writable
 *
 * @param {Object} params
 * @param {Object} params.obj obj to assign value
 * @param {string} params.key key to assign value
 * @param {string} params.value expected value of obj[key]
 */
function isNonWritable({ obj, key, value }) {
  assert.throws(function () {
    obj[key] = 'testNonWritable test value'
  }, new RegExp("(read only property '" + key + "'|Cannot set property " + key + ')'))

  if (value) {
    assert.equal(obj[key], value)
  } else {
    assert.ok(!obj[key], 'testNonWritable test value', 'should not set value when non-writable')
  }
}

/**
 *  Verifies the expected length of children segments and that every
 *  id matches between a segment array and the children
 *
 *  @param {Object} parent trace
 *  @param {Array} segments list of expected segments
 */
function compareSegments(parent, segments) {
  assert.ok(parent.children.length, segments.length, 'should be the same amount of children')
  segments.forEach((segment, index) => {
    assert.equal(parent.children[index].id, segment.id, 'should have same ids')
  })
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
          assert.ok(
            getChildren(child).length === 0,
            'segment "' + child.name + '" should not have any children'
          )
        }
      } else if (typeof sequenceItem === 'object') {
        assertSegments(child, sequenceItem, options)
      }
    }

    // check if correct number of children was found
    assert.equal(children.length, childCount)
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

/**
 * Like `tap.prototype.match`. Verifies that `actual` satisfies the shape
 * provided by `expected`.
 *
 * This may eventually make its way into `node:assert`. See
 * https://github.com/fastify/fastify/discussions/5628#discussioncomment-10392942
 *
 * @example
 * const input = {
 *   foo: /^foo.+bar$/,
 *   bar: [1, 2, '3']
 * }
 * // true
 * match(input, {
 *   foo: 'foo is bar',
 *   bar: [1, 2, '3']
 * })
 * // false
 * match(input, {
 *   foo: 'foo is bar',
 *   bar: [1, 2, '3', 4]
 * })
 *
 * @param {string|object} actual The entity to verify.
 * @param {string|object} expected What the entity should match against.
 *
 * @returns {boolean} `true` if `actual` satisfies `expected`. `false`
 * otherwise.
 */
function match(actual, expected) {
  if (typeof actual === 'string' && typeof expected === 'string') {
    const patterns = expected
      .trim()
      .split(/\r?\n/)
      .map((s) => s.trim())

    let lastIndex = -1
    for (const pattern of patterns) {
      const index = actual.indexOf(pattern)
      if (index === -1 || index < lastIndex) {
        return false
      }
      lastIndex = index
    }
    return true
  }

  for (const key in expected) {
    if (key in actual) {
      if (typeof expected[key] === 'object' && expected[key] !== null) {
        /* c8 ignore next 3 */
        if (!match(actual[key], expected[key])) {
          return false
        }
      } else if (actual[key] !== expected[key]) {
        return false
      }
    } else {
      return false
    }
  }
  return true
}

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

/**
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
function assertMetricValues(transaction, expected, exact) {
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
    assert.ok(metric, 'should have expected metric name')

    assert.deepStrictEqual(metric.toJSON(), expectedMetric[1], 'metric values should match')
  }

  if (exact) {
    const metricsJSON = metrics.toJSON()
    assert.equal(metricsJSON.length, expected.length, 'metrics length should match')
  }
}

module.exports = {
  assertCLMAttrs,
  assertExactClmAttrs,
  assertMetrics,
  assertMetricValues,
  assertSegments,
  compareSegments,
  isNonWritable,
  match
}
