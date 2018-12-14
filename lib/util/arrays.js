'use strict'

exports.findLast = arrayFindLast
exports.findLastIndex = arrayFindLastIndex


/**
* Finds the last element in an array that `pred` matches.
 *
 * @param {Array}     arr   - The array to search.
 * @param {Function}  pred  - A predicate function which returns `true` on matches.
 * @param {*}         [ctx] - The `this` arg for `pred`.
 *
 * @return {*?} - The last matching item if found, otherwise `undefined`.
 */
function arrayFindLast(arr, pred, ctx) {
  var idx = arrayFindLastIndex(arr, pred, ctx)
  if (idx >= 0) {
    return arr[idx]
  }
}

/**
 * Finds the last index of a single element in an array matching `pred`.
 *
 * @param {Array}     arr   - The array to search.
 * @param {Function}  pred  - A predicate function which returns `true` on matches.
 * @param {*}         [ctx] - The `this` arg for `pred`.
 *
 * @return {number} - The index of the last matching item if found, otherwise `-1`.
 */
function arrayFindLastIndex(arr, pred, ctx) {
  for (var i = arr.length - 1; i >= 0; --i) {
    if (pred.call(ctx, arr[i], i, arr)) {
      return i
    }
  }
  return -1
}
