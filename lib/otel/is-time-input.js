/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const isOtelHrTime = require('./is-otel-hr-time.js')

/**
 * Checks whether a value looks like a point in time (a `Date`, an epoch
 * number, or an OTEL hrtime `[seconds, nanoseconds]` tuple) rather than a
 * set of event attributes.
 *
 * @param {*} value The value to check.
 *
 * @returns {boolean} True if the value should be treated as a time.
 */
module.exports = function isTimeInput(value) {
  return (
    typeof value === 'number' ||
    value instanceof Date ||
    isOtelHrTime(value)
  )
}
