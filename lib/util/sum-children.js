'use strict'

/**
 * Given an ordered list of disjoint intervals and a new interval to fold into
 * it, determine if the new interval is a sub-interval (in which case it's
 * redundant), an overlapping interval (in which case, replace the most recent
 * interval on the list with an interval representing the union of the new and
 * last intervals), or otherwise (it's disjoint to what we already
 * have, in which case add it to the list). Meant to be used with
 * Array.reduce().
 *
 * Assumes the list being reduced is sorted by interval start time.
 *
 * @param {Array} accum  The accumulated list of reduced intervals.
 * @param {Array} newest A new pair of range start and end to compare to the
*                        existing intervals.
 *
 * @return {Array} A list of intervals updated to include the new interval.
 */
function reduceIntervals(accum, newest) {
  if (accum && accum.length > 0) {
    // the last interval on the list will always be the latest
    var last = accum.slice(-1)[0]

    // case 1: the new interval is a strict subset of the last interval
    if (newest[0] >= last[0] && newest[1] <= last[1]) {
      return accum
    }
    // case 2: the start of the new interval is inside the last interval
    else if (newest[0] >= last[0] && newest[0] <= last[1]) {
      var heads = accum.slice(0, -1)
      // gotta double-wrap the array I'm appending onto the end
      return heads.concat([[last[0], newest[1]]])
    }
    // case 3: the interval is disjoint
    else {
      return accum.concat([newest])
    }
  }

  // base case: wrap up the newest element to create the accumulator
  return [newest]
}

/**
 * Reduce a list of intervals to the magnitude of the range, eliminating any
 * overlaps.
 *
 * @param {Array} pairs The list of startRange, endRange pairs to reduce.
 * @return {integer} The magnitude of the range, after all the overlaps have
 *                   been smoothed and the holes eliminated.
 */
function sumChildren(pairs) {
  // 1. sort the list of [begin, end] pairs by start time
  var sortedPairs = pairs.sort(function cb_sort(a, b) { return a[0] - b[0]; })

  // 2. reduce the list to a set of disjoint intervals
  // I love ECMAscript 5!
  var disjointIntervals = sortedPairs.reduce(reduceIntervals, [])

  // 3. sum the durations of the intervals
  return disjointIntervals.reduce(function cb_reduce(accum, current) {
    return accum + (current[1] - current[0])
  }, 0)
}

module.exports = sumChildren
