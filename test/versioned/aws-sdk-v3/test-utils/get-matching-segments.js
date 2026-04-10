/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = getMatchingSegments

/**
 * Iterate through the segments in a trace and collect targeted ones into
 * an array.
 *
 * @param {object} params Function parameters.
 * @param {TransactionTrace} params.trace The trace with segments to iterate.
 * @param {TraceSegment} params.segment Specific segment to look for.
 * @param {RegExp} params.pattern Any segments with a name matching this regex
 * will be collected.
 * @param {Array} params.markedSegments The array to store the found segments
 * in.
 *
 * @returns {TraceSegment[]} Matched segments.
 */
function getMatchingSegments({ trace, segment, pattern, markedSegments = [] }) {
  if (pattern.test(segment.name)) {
    markedSegments.push(segment)
  }

  const children = trace.getChildren(segment.id)
  children.forEach((child) => {
    getMatchingSegments({ trace, segment: child, pattern, markedSegments })
  })

  return markedSegments
}
