/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
tap.Test.prototype.addAssert('clmAttrs', 1, assertCLMAttrs)

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
      this.equal(attrs['code.function'], segment.name, 'should have appropriate code.function')
      this.ok(
        attrs['code.filepath'].endsWith(segment.filepath),
        'should have appropriate code.filepath'
      )

      if (!skipFull) {
        this.match(attrs['code.lineno'], /[\d]+/, 'lineno should be a number')
        this.match(attrs['code.column'], /[\d]+/, 'column should be a number')
      }
    } else {
      this.notOk(attrs['code.function'], 'function should not exist')
      this.notOk(attrs['code.filepath'], 'filepath should not exist')
      this.notOk(attrs['code.lineno'], 'lineno should not exist')
      this.notOk(attrs['code.column'], 'column should not exist')
    }
  })
}
