/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Helper that verifies the original callback
 * and wrapped callback are the same
 *
 * @param {object} shim Shimmer instance.
 * @param {Function} cb The callback to check.
 * @param {object} [deps] Injected dependencies.
 * @param {object} [deps.assert] Assertion library to use.
 */
module.exports = function checkNotWrappedCb(shim, cb, { assert = require('node:assert') } = {}) {
  // The callback is always the last argument
  const wrappedCB = arguments[arguments.length - 1]
  assert.equal(wrappedCB, cb)
  assert.equal(shim.isWrapped(wrappedCB), false)
  assert.doesNotThrow(function () {
    wrappedCB()
  })
}
