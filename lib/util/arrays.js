'use strict'

exports.find = arrayFind
exports.findIndex = arrayFindIndex

/**
 * Finds a single element in an array.
 *
 * Remove once Node v0.10, v0.12, v1, v2, and v3 are no longer supported.
 *
 * @deprecated With Node.js v4
 *
 * @param {Array}     arr   - The array to search.
 * @param {Function}  pred  - A predicate function which returns `true` on matches.
 * @param {*}         [ctx] - The `this` arg for `pred`.
 *
 * @return {*?} - The first matching item if found, otherwise `undefined`.
 */
function arrayFind(arr, pred, ctx) {
  var idx = arrayFindIndex(arr, pred, ctx)
  if (idx >= 0) {
    return arr[idx]
  }
}

/**
 * Finds the index of a single element in an array.
 *
 * Remove once Node v0.10, v0.12, v1, v2, and v3 are no longer supported.
 *
 * @deprecated With Node.js v4
 *
 * @param {Array}     arr   - The array to search.
 * @param {Function}  pred  - A predicate function which returns `true` on matches.
 * @param {*}         [ctx] - The `this` arg for `pred`.
 *
 * @return {number} - The index of the first matching item if found, otherwise `-1`.
 */
function arrayFindIndex(arr, pred, ctx) {
  for (var i = 0; i < arr.length; ++i) {
    if (pred.call(ctx, arr[i], i, arr)) {
      return i
    }
  }
  return -1
}
