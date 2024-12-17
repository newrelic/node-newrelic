/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Asserts the wrapped callback is wrapped and the unwrapped version is the original.
 * It also verifies it does not throw an error
 *
 * @param {object} shim Shimmer instance.
 * @param {Function} cb The callback to check.
 * @param {object} [deps] Injected dependencies.
 * @param {object} [deps.assert] Assertion library to use.
 */
module.exports = function checkWrappedCb(shim, cb, { assert = require('node:assert') } = {}) {
  // The wrapped callback is always the last argument
  const wrappedCB = arguments[arguments.length - 1]
  assert.notStrictEqual(wrappedCB, cb)
  assert.ok(shim.isWrapped(wrappedCB))
  assert.equal(shim.unwrap(wrappedCB), cb)

  assert.doesNotThrow(function () {
    wrappedCB()
  })
}
