/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = normalizeTimestamp

const {
  isTimeInputHrTime
} = require('@opentelemetry/core')

/**
 * Returns a normalized epoch in milliseconds based upon the value provided
 * to the logger's `emit` method (if it was provided). The emit method receives
 * a `LogRecord` instance. In the upstream code, a `LogRecord` is supposed to
 * have a nanosecond epoch delta. But we are receiving it from user code. So
 * it is possible for the value to be a variety of different kinds.
 *
 * @see https://github.com/open-telemetry/opentelemetry-js/blob/99dde77/api/src/common/Time.ts#L39
 * @see https://github.com/open-telemetry/opentelemetry-js/blob/99dde77/packages/opentelemetry-core/src/common/time.ts#L61-L83
 *
 * @param {number[]|number|Date|undefined} input The value from the logger.
 *
 * @returns {number}
 */
function normalizeTimestamp(input) {
  if (typeof input === 'number' && input >= 10_000_000_000_000_000) {
    // Looks like a nanosecond epoch delta.
    return Math.floor(input / 1_000_000)
  }

  if (typeof input === 'number' && input >= 100_000_000_000_000) {
    // Looks like a microsecond epoch delta.
    return Math.floor(input / 1_000)
  }

  if (typeof input === 'number' && input >= 100_000_000_000) {
    // Looks like a millisecond epoch delta.
    return input
  }

  if (isTimeInputHrTime(input) === true) {
    return hrtimeToMilliseconds(input)
  }

  if (Object.getPrototypeOf(input) === Date.prototype) {
    return input.getTime()
  }

  // We don't know what they've given us, so just return the current time.
  return Date.now()
}

/**
 * Converts a JS Open Telemetry hrtime tuple to milliseconds since the
 * standard epoch. The OTEL hrtime is created as follows:
 *
 * 1. Convert `performance.timeOrigin` to a `[seconds, nanoseconds]` tuple.
 * 2. Add the result of `performance.now()` to the tuple to adjust to the
 * current time.
 *
 * Thus, the tuple represents a literal point in time that, when converted
 * back to a single integer, can be passed to `new Date()` to get an accurate
 * representation.
 *
 * @param {number[]} hrtime Upstream represents hrtime as `[seconds, nanoseconds]`.
 *
 * @returns {number} Milliseconds since standard epoch time.
 */
function hrtimeToMilliseconds(hrtime) {
  const seconds = hrtime[0]
  const nanoseconds = hrtime[1]

  // Convert the seconds portion to milliseconds.
  const msSeconds = seconds * 1_000
  // Convert the nanoseconds portion to milliseconds.
  const msNanoseconds = nanoseconds / 1_000_000
  // At this point, we have the number of milliseconds since the standard
  // epoch.
  const msSinceEpoch = msSeconds + msNanoseconds

  return Math.trunc(msSinceEpoch)
}
