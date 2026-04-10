/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = checkAWSAttributes

const { match } = require('../../../lib/custom-assertions')
const {
  TRANS_SEGMENT
} = require('./constants.js')

/**
 * Recursively walks the segments in a trace to verify that the expected
 * AWS metadata has been attached by the instrumentation.
 *
 * @param {object} params Function parameters.
 * @param {TransactionTrace} params.trace Trace that contains segments.
 * @param {TraceSegment} params.segment Specific segment to look for which
 * should have the metadata attached.
 * @param {RegExp} params.pattern Regular expression that will be used to
 * match against segment names to find the target segment.
 * @param {TraceSegment[]} params.markedSegments Array to populate with
 * found segments.
 *
 * @throws {Error} When the metadata is not present.
 *
 * @returns {TraceSegment[]} Found matching segments.
 */
function checkAWSAttributes({ trace, segment, pattern, markedSegments = [] }) {
  const expectedAttrs = {
    'aws.operation': String,
    'aws.service': String,
    'aws.requestId': String,
    'aws.region': String
  }

  if (pattern.test(segment.name)) {
    markedSegments.push(segment)
    const attrs = segment.attributes.get(TRANS_SEGMENT)
    match(attrs, expectedAttrs)
  }
  const children = trace.getChildren(segment.id)
  children.forEach((child) => {
    checkAWSAttributes({ trace, segment: child, pattern, markedSegments })
  })

  return markedSegments
}
