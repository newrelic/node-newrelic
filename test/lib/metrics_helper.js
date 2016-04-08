var assert = require('chai').assert
var format = require('util').format

exports.assertMetrics = assertMetrics
exports.assertSegments = assertSegments

function assertMetrics(metrics, expected, exclusive,
    assertValues) {
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
 * @param {TraceSegment} parent Parent segment
 * @param {Array} expected      Array of strings that represent segment names.
 *                              If an item in the array is another array, it represents
 *                              children of the previous item.
 * @param {bool} exact          If true, then the expected segments must match exactly,
 *                              including their position and children on all levels.
 *                              When false, then only check that each child exists.
 */
function assertSegments(parent, expected, exact) {
  var child
  var childCount = 0

  // rather default to what is more likely to fail than have a false test
  if (typeof exact === 'undefined') {
    exact = true
  }

  if (exact) {
    for (var i = 0; i < expected.length; ++i) {
      var sequenceItem = expected[i]

      if (typeof sequenceItem === 'string') {
        child = parent.children[childCount++]
        assert.equal(
          child ? child.name : undefined,
          sequenceItem,
          'segment "' + parent.name + '" should have child "' + sequenceItem +
            '" in position ' + childCount
        )

        // if the next expected item is not array, then check that the current child has no
        // children
        if (!Array.isArray(expected[i+1])) {
          assert(child.children.length === 0, 'segment "' + child.name +
            '" should not have any children')
        }
      } else if (typeof sequenceItem === 'object') {
        assertSegments(child, sequenceItem)
      }
    }

    // check if correct number of children was found
    assert.equal(
      parent.children.length,
      childCount,
      format(
        'segment "%s" expected to have %j children, but got %j',
        parent.name, childCount, parent.children.length
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
