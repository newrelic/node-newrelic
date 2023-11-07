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

// TODO: this doesn't "aggregate". Perhaps we need a different terminology
// for the base-class and then this implementation can avoid the misleading language.
class StreamingSpanEventAggregator extends Aggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.periodMs = opts.periodMs ? opts.periodMs : 1000
    opts.limit = opts.limit ? opts.limit : 10000
    opts.method = opts.method || 'span_event_data'

    super(opts, collector)

    this.stream = opts.span_streamer
    this.metrics = metrics
    this.started = false
    this.isStream = true
  }

  start() {
    if (this.started) {
      return
    }

    logger.trace('StreamingSpanEventAggregator starting up')
    this.stream.connect(this.runId, this.requestHeadersMap)
    this.started = true

    this.emit('started')
  }

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

    this.emit(`finished ${this.method} data send.`)
  }

  /**
   * Not a payload based aggregator
   *
   * This is here to implement the implicit interface
   */
  _toPayloadSync() {
    return
  }

  /**
   * Attempts to add the given segment to the collection.
   *
   * @param {TraceSegment}  segment         - The segment to add.
   * @param {string}        [parentId=null] - The GUID of the parent span.
   * @param isRoot
   * @returns {boolean} True if the segment was added, or false if it was discarded.
   */
  addSegment(segment, parentId, isRoot) {
    if (!this.started) {
      logger.trace('Aggregator has not yet started, dropping span (%s).', segment.name)
      return
    }

    const span = StreamingSpanEvent.fromSegment(segment, parentId, isRoot)
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
