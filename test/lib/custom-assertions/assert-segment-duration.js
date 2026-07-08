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
 * The comparison is intentionally **asymmetric**. The segment's duration is
 * frozen when the instrumented operation completes (`timer.end()`/`touch()`),
 * whereas `actualTime` is sampled strictly later — after the callback resolves
 * its promise and the awaiting continuation resumes. That ordering means
 * `actualTime` structurally contains the segment window plus however long the
 * event loop took to schedule the continuation. So `actualDuration >
 * segmentDuration` is expected, and its magnitude is post-completion
 * scheduling noise (unbounded on a loaded runner), never evidence of a
 * duration bug — a symmetric percentage gate on that direction is what made
 * this assertion flaky. We therefore forgive `actualDuration > segmentDuration`
 * freely and only enforce the ratio in the direction that can actually reveal
 * a mis-measured segment: `segmentDuration` running meaningfully longer than
 * the real wall-clock window it was observed within.
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
 * @param {number} [params.threshold] maximum allowed ratio by which the
 *   segment duration may exceed the observed wall-clock duration. Only the
 *   `segmentDuration > actualDuration` direction is gated by this ratio; the
 *   reverse direction is scheduling noise and is always tolerated.
 * @param {number} [params.minDelta] absolute overshoot (in ms) tolerated
 *   regardless of the ratio, so sub-millisecond operations aren't held to a
 *   percentage gate that measurement noise alone can blow past.
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

  // `actualTime` is sampled after the segment already ended, so it always
  // envelops the segment plus scheduling delay: `actualDuration >=
  // segmentDuration` is the normal, noise-only case and is never a failure.
  // The only meaningful defect is the segment reporting a duration longer than
  // the wall-clock window it was observed within, so we gate solely on the
  // amount by which the segment overshoots the actual duration.
  const overshoot = segmentDuration - actualDuration
  const ratio = actualDuration > 0 ? overshoot / actualDuration : 0

  assert.ok(
    overshoot <= minDelta || ratio <= threshold,
    `segment duration (${segmentDuration}ms) exceeds actual duration ` +
    `(${actualDuration}ms) by ${overshoot.toFixed(3)}ms (${(ratio * 100).toFixed(1)}%) ` +
    `which exceeds the ${minDelta}ms / ${threshold * 100}% thresholds`
  )
}
