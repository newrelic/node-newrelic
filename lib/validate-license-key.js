/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Verifies that a license key conforms to the license key spec. That is,
 * the key is comprised of ASCII characters, excluding space (0x20), with a
 * length between 10 and 64.
 *
 * @param {string} key The key to validate
 * @returns {boolean} True if it is a valid key
 */
module.exports = function validateLicenseKey(key) {
  return /^[\x21-\x7e]{10,64}$/.test(key) === true
}
