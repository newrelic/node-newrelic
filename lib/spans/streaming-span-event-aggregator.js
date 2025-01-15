/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Aggregator = require('../aggregators/base-aggregator')
const StreamingSpanEvent = require('./streaming-span-event')
const logger = require('../logger').child({ component: 'streaming-span-event-aggregator' })

const SEND_WARNING =
  'send() is not currently supported on streaming span event aggregator. ' +
  'This warning will not appear again this agent run.'

/**
 * Indicates that span streaming has begun.
 *
 * @event StreamingSpanEventAggregator#started
 */

/**
 * Indicates that span streaming has finished.
 *
 * @event StreamingSpanEventAggregator#stopped
 */

// TODO: this doesn't "aggregate". Perhaps we need a different terminology
// for the base-class and then this implementation can avoid the misleading language.
/**
 * Handles streaming of spans to the New Relic data collector.
 */
class StreamingSpanEventAggregator extends Aggregator {
  constructor(opts, agent) {
    const { metrics, collector, harvester } = agent
    opts = opts || {}
    opts.periodMs = opts.periodMs ? opts.periodMs : 1000
    opts.limit = opts.limit ? opts.limit : 10000
    opts.method = opts.method || 'span_event_data'

    super(opts, collector, harvester)

    this.stream = opts.span_streamer
    this.metrics = metrics
    this.started = false
    this.isStream = true
  }

  /**
   * Start streaming spans to the collector.
   *
   * @fires StreamingSpanEventAggregator#started
   */
  start() {
    if (this.started) {
      return
    }

    logger.trace('StreamingSpanEventAggregator starting up')
    this.stream.connect(this.runId, this.requestHeadersMap)
    this.started = true

    this.emit('started')
  }

  /**
   * Cease streaming of spans to the collector.
   *
   * @fires StreamingSpanEventAggregator#stopped
   */
  stop() {
    if (!this.started) {
      return
    }

    logger.trace('StreamingSpanEventAggregator stopping')
    this.stream.disconnect()
    this.started = false

    this.emit('stopped')
  }

  send() {
    if (this.started) {
      logger.warnOnce('SEND_WARNING', SEND_WARNING)
    }

    this.emit(`finished_data_send-${this.method}`)
  }

  /**
   * Not a payload based aggregator
   *
   * This is here to implement the implicit interface
   */
  _toPayloadSync() {}

  /**
   * Attempts to add the given segment to the collection.
   *
   * @param {object} params to function
   * @param {TraceSegment} params.segment segment to add.
   * @param {string} [parms.parentId] GUID of the parent span.
   * @param {Transaction} params.transaction active transaction
   * @param {boolean} params.isRoot is segment root segment
   * @param params.parentId
   * @returns {boolean} True if the segment was added, or false if it was discarded.
   */
  addSegment({ segment, transaction, parentId, isRoot }) {
    if (!this.started) {
      logger.trace('Aggregator has not yet started, dropping span (%s).', segment.name)
      return
    }

    const span = StreamingSpanEvent.fromSegment(segment, transaction, parentId, isRoot)
    this.stream.write(span)
  }

  reconfigure(config) {
    super.reconfigure(config)

    this.requestHeadersMap = config.request_headers_map
  }

  createMetrics() {
    this.stream.createMetrics()
  }
}

module.exports = StreamingSpanEventAggregator
