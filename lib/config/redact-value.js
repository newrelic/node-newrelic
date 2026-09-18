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
 * When `envRedaction` is true, only the first and last characters remain visible
 * with `*` (one per character of the value) between them — used when logging the
 * value an environment variable set. When given an array, each element is
 * redacted individually. `fullRedaction` takes precedence over `envRedaction`.
 *
 * @param {*} value The value to redact.
 * @param {object} [options] Redaction options.
 * @param {boolean} [options.fullRedaction] When true, replace the value entirely
 *   with `****` instead of revealing its first 10 characters and length.
 * @param {boolean} [options.envRedaction] When true, reveal only the first and
 *   last characters, masking the rest (e.g. `super secret value` ->
 *   `s******************e`).
 *
 * @returns {string|string[]} The redacted value, or an array of redacted values.
 */
function redactValue(value, { fullRedaction = false, envRedaction = false } = {}) {
  if (Array.isArray(value) === true) {
    return value.map((element) => redactValue(element, { fullRedaction, envRedaction }))
  }

  if (fullRedaction === true) {
    return FULL_REDACTION
  }

  if (envRedaction === true) {
    const string = value.toString()
    return string.at(0) + '*'.repeat(string.length) + string.at(-1)
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
