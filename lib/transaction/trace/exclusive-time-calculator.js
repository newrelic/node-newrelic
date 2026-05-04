/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Merges two sorted arrays of time ranges into a single sorted array of non-overlapping ranges.
 *
 * Each range is a two-element array `[start, end]` representing a time interval.
 * When ranges overlap, they are combined into a single range spanning the full extent.
 *
 * **Note:** This function is destructive — it mutates end times of elements in the input
 * arrays when merging overlapping intervals. Do not reuse the input arrays after calling this.
 *
 * @param {Array} first - A sorted array of `[start, end]` time ranges.
 * @param {Array} second - A sorted array of `[start, end]` time ranges.
 * @returns {Array} A new sorted array of merged, non-overlapping time ranges.
 */
function mergeRanges(first, second) {
  if (!first.length) {
    return second
  }

  if (!second.length) {
    return first
  }

  const res = []
  let resIdx = 0
  let firstIdx = 0
  let secondIdx = 0
  // N.B. this is destructive, it will be updating the end times for range arrays in
  // the input arrays.  If we need to reuse these arrays for anything, this behavior
  // must be changed.
  let currInterval =
    first[firstIdx][0] < second[secondIdx][0] ? first[firstIdx++] : second[secondIdx++]

  while (firstIdx < first.length && secondIdx < second.length) {
    const next = first[firstIdx][0] < second[secondIdx][0] ? first[firstIdx++] : second[secondIdx++]
    if (next[0] <= currInterval[1]) {
      // if the segment overlaps, update the end of the current merged segment
      currInterval[1] = Math.max(next[1], currInterval[1])
    } else {
      // if there is no overlap, start a new merging segment and push the old one
      res[resIdx++] = currInterval
      currInterval = next
    }
  }

  const firstIsRemainder = firstIdx !== first.length
  const remainder = firstIsRemainder ? first : second
  let remainderIdx = firstIsRemainder ? firstIdx : secondIdx

  // merge the segments overlapping with the current interval
  while (remainder[remainderIdx] && remainder[remainderIdx][0] <= currInterval[1]) {
    currInterval[1] = Math.max(remainder[remainderIdx++][1], currInterval[1])
  }

  res[resIdx++] = currInterval

  // append the remaining non-overlapping ranges
  for (; remainderIdx < remainder.length; ++remainderIdx) {
    res[resIdx++] = remainder[remainderIdx]
  }

  return res
}

module.exports = { mergeRanges }
