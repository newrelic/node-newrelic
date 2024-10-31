/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Verifies the expected length of children segments and that every
 * id matches between a segment array and the children
 *
 * @param {object} params to function
 * @param {TraceSegment} params.parent segment
 * @param {Array} params.segments list of expected segments
 * @param {Trace} params.trace transaction trace
 * @param {object} [params.assert] Assertion library to use.
 */
module.exports = function compareSegments({
  parent,
  segments,
  trace,
  assert = require('node:assert')
}) {
  const parentChildren = trace.getChildren(parent.id)
  assert.ok(parentChildren.length, segments.length, 'should be the same amount of children')
  segments.forEach((segment, index) => {
    assert.equal(parentChildren[index].id, segment.id, 'should have same ids')
  })
}
