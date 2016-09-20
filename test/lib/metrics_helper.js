'use strict'

var assert = require('chai').assert
var format = require('util').format

exports.assertMetrics = assertMetrics
exports.assertSegments = assertSegments
exports.findSegment = findSegment

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

  for (var i = 0, len = expected.length; i < len; i++) {
    var expectedMetric = expected[i]
    var metric = metrics.getMetric(
      expectedMetric[0].name,
      expectedMetric[0].scope
    )
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
  var child
  var childCount = 0

  // rather default to what is more likely to fail than have a false test
  var exact = true
  if (options && options.exact === false) {
    exact = options.exact
  } else if (options === false) {
    exact = false
  }

  function getChildren(parent) {
    return parent.children.filter(function(item) {
      if (exact && options && options.exclude) {
        return (options.exclude.indexOf(item.name) === -1)
      } else {
        return true
      }
    })
  }

  var children = getChildren(parent)
  if (exact) {
    for (var i = 0; i < expected.length; ++i) {
      var sequenceItem = expected[i]

      if (typeof sequenceItem === 'string') {
        child = children[childCount++]
        assert.equal(
          child ? child.name : undefined,
          sequenceItem,
          'segment "' + parent.name + '" should have child "' + sequenceItem +
            '" in position ' + childCount
        )

        // if the next expected item is not array, then check that the current child has no
        // children
        if (!Array.isArray(expected[i+1])) {
          // var children = child.children
          assert(getChildren(child).length === 0, 'segment "' + child.name +
            '" should not have any children')
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
        parent.name, childCount, children.length
      )
    )
  } else {
    for (var i = 0; i < expected.length; i++) {
      var sequenceItem = expected[i]
      var child
      if (typeof sequenceItem === 'string') {
        // find corresponding child in parent
        for (var j = 0; j < parent.children.length; j++) {
          if (parent.children[j].name === sequenceItem) {
            child = parent.children[j]
          }
        }
        assert.ok(child, 'segment "' + parent.name + '" should have child "' +
          sequenceItem + '"')
        if (typeof expected[i+1] === 'object') {
          assertSegments(child, expected[i+1], exact)
        }
      }
    }
  }
}

function findSegment(root, name) {
  if (root.name === name) {
    return root
  } else if (root.children && root.children.length) {
    for (var i = 0; i < root.children.length; i++) {
      var child = root.children[i]
      var found = findSegment(child, name)
      if (found) {
        return found
      }
    }
  }
}
