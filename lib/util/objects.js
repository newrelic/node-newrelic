/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
exports = module.exports = { isSimpleObject, isNotEmpty }

/**
 * Convenience function to test if a value is a non-null object
 *
 * @param {object} thing Value to be tested
 * @returns {boolean} whether or not the value is an object and not null
 */
function isSimpleObject(thing) {
  return Object.prototype.toString.call(thing) === '[object Object]' && thing !== null
}

/**
 * Convenience function to test if an object is not empty
 *
 * @param {object} thing Value to be tested
 * @returns {boolean} true if the value is an object, not null, and has keys
 */
function isNotEmpty(thing) {
  return isSimpleObject(thing) && Object.keys(thing).length > 0
}
