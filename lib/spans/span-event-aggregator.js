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
const { SPAN_EVENT_LIMIT } = require('../config')

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
    let reportPeriod = this.defaultPeriod
    let spanLimit = SPAN_EVENT_LIMIT

    if (config.span_event_harvest_config) {
      if (config.span_event_harvest_config.report_period_ms) {
        reportPeriod = config.span_event_harvest_config.report_period_ms

        logger.debug(
          'Using span event report period from span_event_harvest_config.report_period_ms of %s',
          reportPeriod
        )
      }

      if (config.span_event_harvest_config.harvest_limit) {
        const maxSpanSamplesAllowed = config.span_event_harvest_config.harvest_limit

        if (maxSpanSamplesAllowed < spanLimit) {
          spanLimit = maxSpanSamplesAllowed
          logger.debug(
            'Using span event limit from span_event_harvest_config.harvest_limit of %s',
            spanLimit
          )
        }
      }
    }

    return {
      periodMs: reportPeriod,
      limit: spanLimit
    }
  }
}

module.exports = SpanEventAggregator
