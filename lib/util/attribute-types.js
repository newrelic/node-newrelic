/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const VALID_ATTR_TYPES = new Set(['string', 'number', 'boolean'])

/**
 * Checks incoming attribute value against valid types:
 * string, number, & boolean.
 *
 * @param {*} val
 * @returns {boolean}
 */
function isValidType(val) {
  return VALID_ATTR_TYPES.has(typeof val)
}

module.exports = isValidType
