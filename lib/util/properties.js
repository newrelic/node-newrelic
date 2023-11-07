/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const hasOwnProperty = Object.hasOwnProperty

/**
 * Checks if an object has its own property with the given key.
 *
 * It is possible to create objects which do not inherit from `Object` by doing
 * `Object.create(null)`. These objects do not have the `hasOwnProperty` method.
 * This method uses a cached version of `hasOwnProperty` to check for the
 * property, thus avoiding the potential `undefined is not a function` error.
 *
 * @private
 * @param {*}       obj - The item to check for the property on.
 * @param {string}  key - The name of the property to look for.
 * @returns {boolean} True if the given object has its own property with the given
 *  key.
 */
exports.hasOwn = function hasOwn(obj, key) {
  return hasOwnProperty.call(obj, key)
}

/**
 * Checks if a given object is empty.
 *
 * @param {*} obj - The object to check for properties on.
 * @returns {boolean} True if the object has no keys of its own.
 */
exports.isEmpty = function isEmpty(obj) {
  // Use this case for null prototyped objects.
  for (const key in obj) {
    if (exports.hasOwn(obj, key)) {
      return false
    }
  }
  return true
}
