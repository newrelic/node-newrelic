/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Asserts the appropriate Code Level Metrics attributes on a segment
 *
 * @param {object} params params object
 * @param {object} params.segments list of segments to assert { segment, filepath, name }
 * @param {boolean} params.enabled if CLM is enabled or not
 * @param {boolean} params.skipFull flag to skip asserting `code.lineno` and `code.column`
 * @param {object} [deps] Injected dependencies.
 * @param {object} [deps.assert] Assertion library to use.
 */
module.exports = function assertCLMAttrs(
  { segments, enabled: clmEnabled, skipFull = false },
  { assert = require('node:assert') } = {}
) {
  segments.forEach((segment) => {
    const attrs = segment.segment.getAttributes()
    if (clmEnabled) {
      assert.equal(attrs['code.function'], segment.name, 'should have appropriate code.function')
      if (segment.filepath instanceof RegExp) {
        assert.match(
          attrs['code.filepath'],
          segment.filepath,
          'should have appropriate code.filepath'
        )
      } else {
        assert.ok(
          attrs['code.filepath'].endsWith(segment.filepath),
          'should have appropriate code.filepath'
        )
      }

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
