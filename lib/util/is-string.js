/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Tests if argument passed in is a string or String object
 * @param {*} data to check if it is a string
 * @returns {boolean} if string or string object
 */
module.exports = function isString(data) {
  return typeof data === 'string' || data instanceof String
}
