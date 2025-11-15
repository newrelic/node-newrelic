/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Determines if a given string represents an absolute path to a module.
 *
 * @param {string} target Path to a module.
 *
 * @returns {boolean} True if it is an absolute path.
 */
module.exports = function isAbsolutePath(target) {
  const leadChar = target.slice(0, 1)
  if (leadChar !== '.' && leadChar !== '/') {
    return false
  }

  const suffix = target.slice(-4)

  if (suffix.slice(-3) !== '.js' && suffix !== '.cjs' && suffix !== '.mjs') {
    return false
  }

  return true
}
