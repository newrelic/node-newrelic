/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')

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

module.exports = {
  assertCLMAttrs,
  assertExactClmAttrs,
  compareSegments,
  isNonWritable,
  match
}
