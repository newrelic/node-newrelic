/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Asserts that a segment ended at approximately the right time.
 *
 * Both measurements use `segment.timer.hrstart` as their reference point, so
 * this primarily tests that the segment **ended** correctly, not that it
 * **started** correctly. A segment that started late would still pass because
 * both durations would be equally shorter. Testing the start requires an
 * independent clock captured before the operation, but on constrained CI
 * runners the diagnostics channel and subscriber overhead between that clock
 * and `hrstart` is large enough to make any fixed threshold unreliable.
 *
 * Capture `actualTime` as the very first thing after the awaited operation —
 * before any assertions, event lookups, or other work — to keep the
 * measurement window as small as possible:
 *
 * @example
 * // async/await pattern
 * await someOperation()
 * const [segment] = tx.trace.getChildren(tx.trace.root.id)
 * const actualTime = process.hrtime(segment.timer.hrstart)
 * assertSegmentDuration({ segment, actualTime })
 * // ... other assertions ...
 *
 * @example
 * // callback pattern
 * const { segment } = await new Promise((resolve) => {
 *   operation(function callback(err) {
 *     resolve({ segment: agent.tracer.getSegment() })
 *   })
 * })
 * const actualTime = process.hrtime(segment.timer.hrstart)
 * assertSegmentDuration({ segment, actualTime })
 *
 * @example
 * // streaming pattern
 * await streamingOperation()
 * const segment = metrics.findSegment(tx.trace, tx.trace.root, 'External/host/path')
 * const actualTime = process.hrtime(segment.timer.hrstart)
 * assertSegmentDuration({ segment, actualTime })
 *
 * @param {object} params function parameters
 * @param {TraceSegment} params.segment segment to check
 * @param {Array} params.actualTime process.hrtime() duration array [seconds, nanoseconds],
 *   measured from segment.timer.hrstart as the reference point
 * @param {number} [params.threshold] maximum allowed ratio difference between the
 *   two measurements
 * @param {number} [params.minDelta] absolute difference (in ms) tolerated
 *   regardless of the ratio. For sub-millisecond operations the fixed
 *   subscriber/diagnostics-channel overhead between the two measurements can
 *   dominate the ratio (e.g. a 0.3ms difference on a 0.8ms operation is 36%),
 *   so a difference this small is treated as measurement noise rather than a
 *   real discrepancy.
 * @param {object} [params.assert] assertion library to use
 */
module.exports = function assertSegmentDuration({
  segment,
  actualTime,
  threshold = 0.20,
  minDelta = 2,
  assert = require('node:assert')
}) {
  assert.equal(segment._isEnded(), true, 'segment should have ended')

  const segmentDuration = segment.getDurationInMillis()
  const actualDuration = actualTime[0] * 1e3 + actualTime[1] / 1e6

  const maxDuration = Math.max(actualDuration, segmentDuration)
  const diff = Math.abs(actualDuration - segmentDuration)
  const ratio = maxDuration > 0 ? diff / maxDuration : 0

  assert.ok(
    diff <= minDelta || ratio <= threshold,
    `segment duration (${segmentDuration}ms) and actual duration (${actualDuration}ms) ` +
    `differ by ${diff.toFixed(3)}ms (${(ratio * 100).toFixed(1)}%) which exceeds the ` +
    `${minDelta}ms / ${threshold * 100}% thresholds`
  )
}
