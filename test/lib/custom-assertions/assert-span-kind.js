/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Gets all spans created during transaction and iterates over to assert the span kind
 * for each segment in the transaction matches the provided expected `segments`.
 *
 * @example
 * assertSpanKind({
 *   agent,
 *   segments: [{ name: 'expectedSegment', kind: 'server' }]
 * })
 *
 * @param {object} params to function
 * @param {Agent} params.agent instance of agent
 * @param {segments} params.segments collection of span names and their respective span kind
 * @param {object} params.assert assertion library
 */
module.exports = function assertSpanKind({ agent, segments, assert = require('node:assert') }) {
  const spans = agent.spanEventAggregator.getEvents()
  if (segments) {
    segments.forEach((segment) => {
      const span = spans.find((s) => s.intrinsics.name === segment.name)
      if (!span) {
        assert.fail(`Could not find span: ${segment.name}`)
      }
      assert.equal(span.intrinsics['span.kind'], segment.kind)
    })
  } else {
    assert.fail('Custom assertion must either pass in an array of span kinds or a collection of segment names to span kind')
  }
}
