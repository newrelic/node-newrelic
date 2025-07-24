/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = severityToString

const SEV_UNKNOWN = 'unknown'
const SEV_TRACE = 'trace'
const SEV_DEBUG = 'debug'
const SEV_INFO = 'info'
const SEV_WARN = 'warn'
const SEV_ERROR = 'error'
const SEV_FATAL = 'fatal'
const severityMap = new Map([
  [0, SEV_UNKNOWN],
  [1, SEV_TRACE],
  [2, SEV_TRACE],
  [3, SEV_TRACE],
  [4, SEV_TRACE],
  [5, SEV_DEBUG],
  [6, SEV_DEBUG],
  [7, SEV_DEBUG],
  [8, SEV_DEBUG],
  [9, SEV_INFO],
  [10, SEV_INFO],
  [11, SEV_INFO],
  [12, SEV_INFO],
  [13, SEV_WARN],
  [14, SEV_WARN],
  [15, SEV_WARN],
  [16, SEV_WARN],
  [17, SEV_ERROR],
  [18, SEV_ERROR],
  [19, SEV_ERROR],
  [20, SEV_ERROR],
  [21, SEV_FATAL],
  [22, SEV_FATAL],
  [23, SEV_FATAL],
  [24, SEV_FATAL]
])

/**
 * Converts the OTEL severity number to a recognizable string.
 *
 * @see https://github.com/open-telemetry/opentelemetry-specification/blob/c041658/specification/logs/data-model.md?plain=1#L292-L299
 *
 * @param {number} severityNumber The number to convert.
 *
 * @returns {string} The known string.
 */
function severityToString(severityNumber) {
  return severityMap.get(severityNumber) ?? SEV_UNKNOWN
}
