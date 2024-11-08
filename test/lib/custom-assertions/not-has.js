/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const get = require('../../../lib/util/get')

/**
 * Asserts that the `found` object does not contain a property as defined
 * by `doNotWant`.
 *
 * @param {object} params Input parameters
 * @param {object} found The object to test for absence.
 * @param {string} doNotWant Dot separated path to a field that should not
 * have a value.
 * @param {string} [msg] Assertion message to include.
 * @param {object} [deps] Injected dependencies.
 * @param {object} [deps.assert] Assertion library to use.
 *
 * @throws {Error} When the `found` object contains a value at the specified
 * `doNotWant` path.
 */
module.exports = function notHas(
  { found, doNotWant, msg },
  { assert = require('node:assert') } = {}
) {
  const result = get(found, doNotWant)
  assert.equal(result, undefined, msg)
}
