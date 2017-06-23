'use strict'

var hasOwnProperty = Object.hasOwnProperty

/**
 * Checks if an object has its own property with the given key.
 *
 * It is possible to create objects which do not inherit from `Object` by doing
 * `Object.create(null)`. These objects do not have the `hasOwnProperty` method.
 * This method uses a cached version of `hasOwnProperty` to check for the
 * property, thus avoiding the potential `undefined is not a function` error.
 *
 * @private
 *
 * @param {*}       obj - The item to check for the property on.
 * @param {string}  key - The name of the property to look for.
 *
 * @return {bool} True if the given object has its own property with the given
 *  key.
 */
exports.hasOwn = function hasOwn(obj, key) {
  return hasOwnProperty.call(obj, key)
}
