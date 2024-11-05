/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = function assertExactClmAttrs(
  segmentStub,
  expectedAttrs,
  { assert = require('node:assert') } = {}
) {
  const attrs = segmentStub.addAttribute.args
  const attrsObj = attrs.reduce((obj, [key, value]) => {
    obj[key] = value
    return obj
  }, {})
  assert.deepEqual(attrsObj, expectedAttrs, 'CLM attrs should match')
}
