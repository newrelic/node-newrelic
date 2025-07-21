/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * This function is used to verify that a tree of trace segments matches an
 * expected tree of segment names. For example, if the trace looks like (i.e
 * the `parent` parameter):
 *
 * ```js
 * {
 *   name: 'root-segment',
 *   children: [
 *    {
 *      name: 'child 1',
 *      children: [
 *        {
 *          name: 'grandchild 1',
 *          children: [
 *            {
 *              name: 'great-grandchild',
 *              children: []
 *            }
 *          ]
 *        },
 *        {
 *          name: 'grandchild 2',
 *          children: []
 *        }
 *      ]
 *    },
 *    {
 *      name: 'child 2',
 *      children: []
 *    }
 *   ]
 * }
 * ```
 *
 * Then the provided `expected` parameter should look like:
 *
 * ```js
 * [
 *   'root-segment',
 *   [
 *     'child 1',
 *     [
 *      'grandchild 1',
 *      ['great-grandchild],
 *      'grandchild 2'
 *     ],
 *     'child 2'
 *   ],
 * ]
 * ```
 *
 * Ordering of the elements in the `expected` parameter is significant when
 * `options.exact = true`. Regardless of the `exact` value, ordering of elements
 * is significant to indicate the nesting order. Any string immediately
 * followed by an array of strings indicates that the first string is a parent
 * element, and the subsequent array of strings is its child elements.
 *
 * @param {Trace} trace             Transaction trace
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
 * @param {object} [deps] Injected dependencies.
 * @param {object} [deps.assert] Assertion library to use.
 * @param options
 * @param root0
 * @param root0.assert
 * @param options.assert
 */
module.exports = function assertSegments( // eslint-disable-line sonarjs/cognitive-complexity
  trace,
  parent,
  expected,
  options,
  { assert = require('node:assert') } = {}
) {
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
    const children = trace.getChildren(_parent.id)
    return children.filter(function (item) {
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
        assertSegments(trace, child, sequenceItem, options, { assert })
      }
    }

    // check if correct number of children was found
    assert.equal(children.length, childCount)
  } else {
    for (let i = 0; i < expected.length; i++) {
      const sequenceItem = expected[i]

      if (typeof sequenceItem === 'string') {
        const child = children.find((segment) => segment.name === sequenceItem)
        assert.ok(child, 'segment "' + parent.name + '" should have child "' + sequenceItem + '"')
        if (typeof expected[i + 1] === 'object') {
          assertSegments(trace, child, expected[i + 1], { exact }, { assert })
        }
      }
    }
  }
}
