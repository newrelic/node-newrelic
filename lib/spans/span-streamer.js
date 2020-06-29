/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({component: 'span-streamer'})
const NAMES = require('../metrics/names').INFINITE_TRACING

const SPAN_DROP_MSG =
  'Queue full, dropping spans.'
const SPAN_DROP_INTERVAL = 5


class SpanStreamer {
  constructor(license_key, connection, metrics, queue_size) {
    this.stream = null
    this.license_key = license_key
    this.connection = connection
    this.queue_size = queue_size
    this.spans = []
    this._metrics = metrics
    this._writable = false

    // 'connected' indicates a safely writeable stream.
    // May still be mid-connect to gRPC server.
    this.connection.on('connected', (stream) =>{
      logger.info('Span streamer connected')
      this.stream = stream
      this._writable = true
      this.sendQueue()
    })

    this.connection.on('disconnected', () =>{
      logger.info('Span streamer disconnected')
      this.stream = null
      this._writable = false
    })
  }

  /* Accepts a span and either writes it to the stream, queues it to be sent,
   * or drops it depending on stream/queue state
   */
  write(span) {
    this._metrics.getOrCreateMetric(NAMES.SEEN).incrementCallCount()

    // If not writeable (because of backpressure) queue the span
    if (!this._writable) {
      if (this.spans.length <= this.queue_size) {
        this.spans.push(span)
        return
      }

      // If the queue is full drop the span
      logger.infoOncePer(
        // key for the OncePer
        'SPAN_DROP_MSG',
        // interval in ms
        SPAN_DROP_INTERVAL * 1000,
        // message
        SPAN_DROP_MSG + ' Will not warn again for %s seconds.',
        // variables to put in log message
        SPAN_DROP_INTERVAL
      )

      return
    }

    const formattedSpan = span.toStreamingFormat()

    try {
      this.send(formattedSpan)
    } catch (err) {
      logger.error(err)
      // TODO: something has gone horribly wrong.
      // We may want to log and turn off this aggregator
      // to prevent sending further spans. Maybe even "disable" their creation?
      // or is there a situation where we can recover?
    }
  }

  /**
   *  Sends the span over the stream. Spans are only sent here if the stream is
   *  in a writable state. If the stream becomes unwritable after sending the
   *  span, a drain event handler is setup to continue writing when possible.
   */
  send(span) {
    // false indicates the stream has reached the highWaterMark
    // and future writes should be avoided until drained. written items,
    // including the one that returned false, will still be buffered.
    this._writable = this.stream.write(span)
    this._metrics.getOrCreateMetric(NAMES.SENT).incrementCallCount()

    if (!this._writable) {
      const waitDrainStart = Date.now()
      const onDrain = this.drain.bind(this, waitDrainStart)
      this.stream.once('drain', onDrain)
    }
  }

  /**
   *  Drains the span queue that built up when the connection was
   *  back-pressured or disconnected. `waitDrainStart` is when the stream
   *  initially blocked, used to time how long the stream was blocked. If this
   *  is not defined, it is assumed this is being called after a reconnect,
   *  and the metric is not used.
   */
  drain(waitDrainStart) {
    // Metric can be used to see how frequently completing drains as well as
    // average time to drain from when we first notice.
    const drainCompleted = Date.now()
    const drainDurationMs = drainCompleted - waitDrainStart
    this._metrics.getOrCreateMetric(NAMES.DRAIN_DURATION)
      .recordValue(drainDurationMs / 1000)

    // Once the 'drain' event fires we can begin writing to the stream again
    this._writable = true

    this.sendQueue()
  }

  sendQueue() {
    // Continue sending the spans that were in the queue. _writable is checked
    // so that if a send fails while clearing the queue, this drain handler can
    // finish, and the drain handler setup on the failed send will then attempt
    // to clear the queue
    while (this.spans.length > 0 && this._writable) {
      const nextObject = this.spans.shift()
      this.send(nextObject)
    }
  }

  connect(agent_run_id, requestHeadersMap) {
    this.connection.setConnectionDetails(
      this.license_key,
      agent_run_id,
      requestHeadersMap
    )

    this.connection.connectSpans()
  }

  disconnect() {
    this.connection.disconnect()
  }
}

module.exports = SpanStreamer
