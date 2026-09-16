/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = redactValue

const FULL_REDACTION = '****'

/**
 * Redacts a value. By default the redaction preserves the value's original
 * length: the first 10 characters remain visible and the rest are replaced with
 * `*`, while values of 10 or fewer characters are fully masked, and falsy values
 * redact to an empty string. When `fullRedaction` is true, the value is replaced
 * with a fixed `****` and neither its length nor any characters are revealed.
 * When given an array, each element is redacted individually.
 *
 * @param {*} value The value to redact.
 * @param {object} [options] Redaction options.
 * @param {boolean} [options.fullRedaction] When true, replace the value entirely
 *   with `****` instead of revealing its first 10 characters and length.
 *
 * @returns {string|string[]} The redacted value, or an array of redacted values.
 */
function redactValue(value, { fullRedaction = false } = {}) {
  if (Array.isArray(value) === true) {
    return value.map((element) => redactValue(element, { fullRedaction }))
  }

  if (fullRedaction === true) {
    return FULL_REDACTION
  }

  if (!value) {
    return ''
  }

  const string = value.toString()
  if (string.length <= 10) {
    return '*'.repeat(string.length)
  }
  return string.substring(0, 10) + '*'.repeat(string.length - 10)
}
