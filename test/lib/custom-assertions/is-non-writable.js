/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * assertion to test if a property is non-writable
 *
 * @param {Object} params
 * @param {Object} params.obj obj to assign value
 * @param {string} params.key key to assign value
 * @param {string} params.value expected value of obj[key]
 * @param {object} [deps] Injected dependencies.
 * @param {object} [deps.assert] Assertion library to use.
 */
module.exports = function isNonWritable(
  { obj, key, value },
  { assert = require('node:assert') } = {}
) {
  assert.throws(function () {
    obj[key] = 'testNonWritable test value'
  }, new RegExp("(read only property '" + key + "'|Cannot set property " + key + ')'))

  if (value) {
    assert.strictEqual(obj[key], value)
  } else {
    assert.notStrictEqual(
      obj[key],
      'testNonWritable test value',
      'should not set value when non-writable'
    )
  }
}
