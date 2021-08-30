/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger')
let spanLogger = null
const EventAggregator = require('../aggregators/event-aggregator')
const SpanEvent = require('./span-event')
const NAMES = require('../metrics/names')

const SPAN_EVENT_MIN_LIMIT = 1000
// Used only when server value missing
const SPAN_EVENT_FALLBACK_MAX_LIMIT = 10000

class SpanEventAggregator extends EventAggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.method = opts.method || 'span_event_data'
    opts.metricNames = opts.metricNames || NAMES.SPAN_EVENTS

    spanLogger = logger.child({ component: 'span_aggregator' })

    super(opts, collector, metrics)
  }

  _toPayloadSync() {
    const events = this.events

    if (events.length === 0) {
      spanLogger.debug('No span events to send.')
      return
    }

    const metrics = {
      reservoir_size: events.limit,
      events_seen: events.seen
    }
    const eventData = events.toArray()

    return [this.runId, metrics, eventData]
  }

  start() {
    logger.debug('starting SpanEventAggregator')
    return super.start()
  }

  send() {
    if (spanLogger.traceEnabled()) {
      spanLogger.trace(
        {
          spansCollected: this.length,
          spansSeen: this.seen
        },
        'Entity stats on span harvest'
      )
    }
    super.send()
  }

  /**
   * Attempts to add the given segment to the collection.
   *
   * @param {TraceSegment}  segment         - The segment to add.
   * @param {string}        [parentId=null] - The GUID of the parent span.
   *
   * @return {boolean} True if the segment was added, or false if it was discarded.
   */
  addSegment(segment, parentId, isRoot) {
    // Check if the priority would be accepted before creating the event object.
    const tx = segment.transaction

    if (tx.priority < this._items.getMinimumPriority()) {
      ++this.events.seen
      this._metrics.getOrCreateMetric(this._metricNames.SEEN).incrementCallCount()

      return false
    }
    const span = SpanEvent.fromSegment(segment, parentId || null, isRoot)
    return this.add(span, tx.priority)
  }

  /**
   * Reconfigure the `SpanEventAggregator` based on values from server
   *
   * @param {Config} config
   */
  reconfigure(config) {
    super.reconfigure(config)

    const { periodMs, limit } = this._getValidSpanConfiguration(config)

    this.periodMs = periodMs
    this.limit = limit
    this._items.setLimit(this.limit)
  }

  /**
   * Compares values from server vs defaults enforced in agent.
   * Use the minimum between `1000` and `span_event_harvest_config.harvest_limit`
   * as the number of span events during a harvest cycle
   *
   * @param {Config} config
   */
  _getValidSpanConfiguration(config) {
    const { reportPeriodMs, harvestLimit } = _getSpanHarvestConfiguration(config)
    const maxLimit = harvestLimit || SPAN_EVENT_FALLBACK_MAX_LIMIT

    let spanLimit = config.span_events.max_samples_stored || SPAN_EVENT_MIN_LIMIT
    spanLimit = _enforceMinLimit(spanLimit, SPAN_EVENT_MIN_LIMIT)
    spanLimit = _enforceMaxLimit(spanLimit, maxLimit)

    const reportPeriod = reportPeriodMs || this.defaultPeriod

    return {
      periodMs: reportPeriod,
      limit: spanLimit
    }
  }
}

function _getSpanHarvestConfiguration(config) {
  if (config.span_event_harvest_config) {
    logger.trace('Using span_event_harvest_config values.', config.span_event_harvest_config)
    const result = {
      reportPeriodMs: config.span_event_harvest_config.report_period_ms,
      harvestLimit: config.span_event_harvest_config.harvest_limit
    }

    return result
  }

  logger.trace('No span_event_harvest_config found in configuration.')
  return {}
}

function _enforceMinLimit(currentLimit, minLimit) {
  let spanLimit = currentLimit
  if (spanLimit < minLimit) {
    spanLimit = minLimit

    logger.debug('Using minimum allowed span event limit of %s', minLimit)
  }

  return spanLimit
}

function _enforceMaxLimit(currentLimit, maxLimit) {
  let spanLimit = currentLimit
  if (spanLimit > maxLimit) {
    spanLimit = maxLimit

    logger.debug('Using maximum allowed span event limit of %s', maxLimit)
  }

  return spanLimit
}

module.exports = SpanEventAggregator
