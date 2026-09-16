/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = redactValue

/**
 * Replaces a value with a redaction string.
 *
 * @param {*} value The value to redact.
 *
 * @returns {string|string[]} The redacted value or set of redacted values.
 */
function redactValue(value) {
  const REDACT_VALUE = '****'

  return Array.isArray(value) === true
    ? value.map(() => REDACT_VALUE)
    : REDACT_VALUE
}
