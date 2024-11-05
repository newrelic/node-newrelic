/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Verifies the expected length of children segments and that every
 * id matches between a segment array and the children
 *
 * @param {Object} parent trace
 * @param {Array} segments list of expected segments
 * @param {object} [deps] Injected dependencies.
 * @param {object} [deps.assert] Assertion library to use.
 */
module.exports = function compareSegments(
  parent,
  segments,
  { assert = require('node:assert') } = {}
) {
  assert.ok(parent.children.length, segments.length, 'should be the same amount of children')
  segments.forEach((segment, index) => {
    assert.equal(parent.children[index].id, segment.id, 'should have same ids')
  })
}
