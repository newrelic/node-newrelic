/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Determines if the input is an Open Telemetry `HrTime` tuple, i.e. a
 * `[seconds, nanoseconds]` pair. This is a copy of upstream's implementation
 * in the `@opentelemetry/core` package. We use a local copy so that we
 * do not have to depend directly on that package for the function. Doing so
 * makes it complicated to properly lazy load the package for the AWS Lambda
 * "slim" layer.
 *
 * @see https://github.com/open-telemetry/opentelemetry-js/blob/99dde77/packages/opentelemetry-core/src/common/time.ts#L142-L149
 *
 * @param {*} value The value to check.
 *
 * @returns {boolean} True when the value is an `HrTime` tuple.
 */
module.exports = function isOtelHrTime(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  )
}
