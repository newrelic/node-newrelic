/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../../logger').child({ component: 'partial-trace' })
const { PARTIAL_TRACE } = require('../../metrics/names')

/**
 * A PartialTrace manages span processing for partial granularity traces.
 * It handles span reparenting, compaction logic, and finalization of span events.
 */
class PartialTrace {
  constructor(transaction) {
    this.transaction = transaction
    this.metrics = transaction.metrics
    this.spans = []
    this.droppedSpans = new Map()
    this.compactSpanGroups = {}
    this.type = transaction.partialType
  }

  /**
   * Adds necessary partial tracing metrics
   *  - `Supportability/Nodejs/PartialGranularity/<partial granularity type>`
   *  - `Supportability/DistributedTrace/PartialGranularity/<partial granularity type>/Span/Instrumented`
   *  - `Supportability/DistributedTrace/PartialGranularity/<partial granularity type>/Span/Kept`
   *
   *  @param {boolean} spanKept flag to tell if we should increment Kept metric
   */
  createMetrics(spanKept) {
    this.metrics.getOrCreateMetric(`${PARTIAL_TRACE.PREFIX}/${this.type}`).incrementCallCount()
    const prefix = `${PARTIAL_TRACE.SPAN_PREFIX}/${this.type}`
    this.metrics.getOrCreateMetric(`${prefix}${PARTIAL_TRACE.INSTRUMENTED}`).incrementCallCount()

    if (spanKept) {
      this.metrics.getOrCreateMetric(`${prefix}${PARTIAL_TRACE.KEPT}`).incrementCallCount()
    }
  }

  /**
   * Called in `lib/spans/span-event-aggregator` which creates the spans from trace
   * Called when a transaction ends. Generates all the spans from trace.
   * This eventually calls `SpanEventAggregator.addSegment`. instead of enqueuing
   * span to SpanEventAggregator it will call `this.addSpan`
   * When all spans have been generated and stored on partial trace, it will call
   * `this.finalize`. Which takes care of reparenting or if compact will compact spans
   */
  generateSpanEvents() {
    this.transaction.trace.generateSpanEvents(this.transaction.trace.segments.root)
    this.finalize()
  }

  /**
   * Runs a span through partial tracing rules.
   * If the span is null, it indicates that the span was dropped,
   * and we must keep track of its id and parentId for potential reparenting.
   *
   * @param {object} params to function
   * @param {string} params.span to apply partial rules to
   * @param {boolean} params.isEntry flag indicating span is entry point span
   */
  addSpan({ span, isEntry }) {
    const id = span.id
    const parentId = span.parentId
    const spanLinks = span.spanLinks
    span = span.applyPartialTraceRules({ isEntry, partialTrace: this })
    this.createMetrics(!!span)
    if (span) {
      // span was not dropped, add to trace until all spans have been processed
      this.spans.push(span)
    } else if (this.type !== 'compact') {
      // span was dropped so keep track of its id and parent as any spans
      // whose parent id was dropped needs to update to this new id
      // unless compact where all parentIds are assigned to the entry span
      // in finalizeSpanEvents
      this.droppedSpans.set(id, parentId)

      // span was dropped but we still need to move its span links to the last kept span
      // spanLinks were captured before the span was dropped
      if (spanLinks && spanLinks.length > 0) {
        this.reparentSpanLinks(spanLinks)
      }
    }
  }

  /**
   * Iterates over the span links from a dropped span and reassigns them to the last kept span.
   * The id intrinsic attribute will also be updated to the value of the last kept span id.
   *
   * @param {SpanLink[]} spanLinks an array of span links to reparent to last kept span
   */
  reparentSpanLinks(spanLinks) {
    const lastSpan = this.spans.at(-1)

    // The id intrinsics attribute needs to be updated to equal the id of the new span the
    // span links are moving to.
    for (const link of spanLinks) {
      link.intrinsics.id = lastSpan.id
    }

    // move the span links events to the last kept span
    Array.prototype.push.apply(lastSpan.spanLinks, spanLinks)
  }

  /**
   * Iterates over dropped spans and reparents span if its current parent was dropped.
   * It'll traverse until it finds a parent that wasn't dropped or there are no more parents to check.
   *
   * @param {SpanEvent} span the span to potentially reparent
   */
  maybeReparentSpan(span) {
    let result = this.droppedSpans.get(span.parentId)
    let count = 0
    while (this.droppedSpans.has(result) && count < this.droppedSpans.size) {
      result = this.droppedSpans.get(result)
      count++
    }

    if (result) {
      logger.debug(`Reparenting span ${span.id} from parent ${span.parentId} to ${result}`)
      span.addIntrinsicAttribute('parentId', result)
    }
  }

  /**
   * Checks if span has error attributes. If no error has been stored metadata,
   * store incoming one. otherwise check if the incoming span started later, if so store
   *
   * @param {object} meta metadata for a given applyCompaction run
   * @param {SpanEvent} span an exit span to the same entity as retained span
   */
  compactionError(meta, span) {
    // store the error that occurs in all exit spans
    if (span.hasErrorAttrs) {
      if (!meta.errorSpan) {
        meta.errorSpan = span
        logger.trace('Partial trace is compact, found an error to use from span %s, error attrs %s', span.intrinsics.name, span.errorAttrs)
      } else if (span.intrinsics.timestamp > meta.errorSpan.intrinsics.timestamp) {
        meta.errorSpan = span
        logger.trace('Partial trace is compact, span occurred after exiting error, re-assigning error to use from span %s, error attrs %s', span.intrinsics.name, span.errorAttrs)
      }
    }
  }

  /**
   * Compares the metadata to decide if it needs to re-assign currentStart, currentEnd
   * and/or increment totalDuration
   *
   * @param {object} meta metadata for a given applyCompaction run
   * @param {SpanEvent} span an exit span to the same entity as retained span
   */
  calculateDuration(meta, span) {
    const start = span.intrinsics.timestamp / 1000
    // duration is captured in seconds, need to convert to milliseconds as timestamp is in millis
    const end = start + span.intrinsics.duration

    if (meta.currentStart === null) {
      // first interval
      meta.currentStart = start
      meta.currentEnd = end
    } else if (meta.currentEnd >= start) {
      // interval overlaps, extend the current end
      meta.currentEnd = Math.max(meta.currentEnd, end)
    } else {
      // non-overlapping, add current interval duration and start new interval
      meta.totalDuration += meta.currentEnd - meta.currentStart
      meta.currentStart = start
      meta.currentEnd = end
    }
  }

  /**
   * Checks if span was the retained exit span for a given entity and it has other spans that talked to the same
   * entity. It will then sort all timestamps for spans that got dropped and calculate the `nr.durations` and assign
   * `nr.ids` for all dropped spans to same entity.
   *
   * @param {SpanEvent} span to check if it has to calculate `nr.durations` and `nr.ids`
   */
  applyCompaction(span) {
    const sameEntitySpans = this.compactSpanGroups[span.id]

    if (!sameEntitySpans) {
      logger.trace('Partial trace is compact, but not an exit span, not assigning `nr.ids` nor `nr.durations` to span %s', span.intrinsics.name)
      return
    }

    logger.trace('Partial trace is compact, and an exit span, updating parentId(%s) to span %s', this.transaction.baseSegment.id, span.intrinsics.name)
    span.addIntrinsicAttribute('parentId', this.transaction.baseSegment.id)

    if (sameEntitySpans?.length < 2) {
      logger.trace('Partial trace is compact, but no exit spans were dropped, not assigning `nr.ids` nor `nr.durations` to span %s', span.intrinsics.name)
      return
    }

    const meta = {
      ids: [],
      totalDuration: 0,
      currentStart: null,
      currentEnd: null,
      errorSpan: null
    }

    // timestamps must be sorted to accurately calculate overlapping durations
    sameEntitySpans.sort((a, b) => a.intrinsics.timestamp - b.intrinsics.timestamp)

    for (let i = 0; i < sameEntitySpans.length; i++) {
      const sameEntitySpan = sameEntitySpans[i]
      // do not push its own id to `nr.ids`
      // first span in array is always the retained exit span
      if (i !== 0) {
        meta.ids.push(sameEntitySpan.id)
      }

      this.compactionError(meta, sameEntitySpan)
      this.calculateDuration(meta, sameEntitySpan)
    }

    // add the final interval duration
    if (meta.currentStart !== null) {
      meta.totalDuration += meta.currentEnd - meta.currentStart
    }

    logger.trace('Partial trace is compact, assigning `nr.ids`: %s, `nr.durations`: %s, to span %s', meta.ids, meta.totalDuration, span.intrinsics.name)
    this.transaction.metrics.getOrCreateMetric(PARTIAL_TRACE.DROPPED).incrementCallCount(meta.ids.length)
    span.addIntrinsicAttribute('nr.ids', meta.ids)
    span.addIntrinsicAttribute('nr.durations', meta.totalDuration)

    if (meta.errorSpan) {
      for (const [key, value] of Object.entries(meta.errorSpan.errorAttrs)) {
        // value of `error.expected` is a boolean, cannot truncate it
        const truncateExempt = key === 'error.expected' ? true : false
        span.addAttribute(key, value, truncateExempt)
      }
    }
  }

  reset() {
    this.spans.length = 0
    this.droppedSpans.clear()
    this.compactSpanGroups = {}
  }

  /**
   * Finalizes span events for partial traces by reparenting spans
   * if their parent was dropped, associates `nr.ids` and `nr.durations` intrinsics for
   * partial traces of type `compact`. Lastly, adds the span events to the span event
   * aggregator.
   *
   * Note: This is a no-op for full traces and traces using infinite tracing.
   */
  finalize() {
    for (const span of this.spans) {
      if (this.type === 'compact') {
        this.applyCompaction(span)
      } else {
        this.maybeReparentSpan(span)
      }

      this.transaction.agent.spanEventAggregator.add(span, this.transaction.priority)
    }

    this.reset()
  }
}

module.exports = PartialTrace
