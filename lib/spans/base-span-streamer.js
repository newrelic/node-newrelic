/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'base-span-streamer' })
const NAMES = require('../metrics/names').INFINITE_TRACING
const SPAN_DROP_MSG_INTERVAL_MS = 30000
const SPAN_DROP_MSG =
  'Queue full, dropping spans. ' +
  `Will not warn again for ${SPAN_DROP_MSG_INTERVAL_MS / 1000} seconds.`

class BaseSpanStreamer {
  constructor(licenseKey, connection, metrics, queueSize) {
    this.stream = null
    this.license_key = licenseKey
    this.connection = connection
    this.queue_size = queueSize
    this.spans = []
    this._metrics = metrics
    this._writable = false

    // 'connected' indicates a safely writeable stream.
    // May still be mid-connect to gRPC server.
    this.connection.on('connected', (stream) => {
      logger.info('Span streamer connected')
      this.stream = stream
      this._writable = true
      this.sendQueue()
    })

    this.connection.on('disconnected', () => {
      logger.info('Span streamer disconnected')
      this.stream = null
      this._writable = false
    })
  }

  addToQueue() {
    throw new Error('addToQueue is not implemented')
  }

  sendQueue() {
    throw new Error('sendQueue is not implemented')
  }

  /* Accepts a span and either writes it to the stream, queues it to be sent,
   * or drops it depending on stream/queue state
   */
  write(span) {
    this._metrics.getOrCreateMetric(NAMES.SEEN).incrementCallCount()

    // If not writeable (because of backpressure) queue the span
    if (!this._writable) {
      if (this.spans.length < this.queue_size) {
        this.addToQueue(span)
        return
      }

      // While this can be directionally calculated between seen/sent the
      // queue makes that a bit more disconnected. This will be a bit more specific.
      this._metrics.getOrCreateMetric(NAMES.DROPPED).incrementCallCount()

      // If the queue is full drop the span
      logger.infoOncePer(
        'SPAN_DROP_MSG', // key for the OncePer
        SPAN_DROP_MSG_INTERVAL_MS,
        SPAN_DROP_MSG
      )
    }
  }

  /**
   *  Sends the data(spans or span) over the stream. Spans are only sent here if the stream is
   *  in a writable state. If the stream becomes unwritable after sending the
   *  span, a drain event handler is setup to continue writing when possible.
   *
   * @param {*} data spans or span
   * @param {number} [spanLen=1] number of spans sent in a stream(defaults to 1)
   */
  send(data, spanLen = 1) {
    // false indicates the stream has reached the highWaterMark
    // and future writes should be avoided until drained. written items,
    // including the one that returned false, will still be buffered.
    this._writable = this.stream.write(data)
    this._metrics.getOrCreateMetric(NAMES.SENT).incrementCallCount(spanLen)

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
   *
   * @param {number} waitDrainStart time that drain started
   */
  drain(waitDrainStart) {
    // Metric can be used to see how frequently completing drains as well as
    // average time to drain from when we first notice.
    const drainCompleted = Date.now()
    const drainDurationMs = drainCompleted - waitDrainStart
    this._metrics.getOrCreateMetric(NAMES.DRAIN_DURATION).recordValue(drainDurationMs / 1000)

    // Once the 'drain' event fires we can begin writing to the stream again
    this._writable = true

    this.sendQueue()
  }

  connect(agentRunId, requestHeadersMap) {
    this.connection.setConnectionDetails(this.license_key, agentRunId, requestHeadersMap)

    this.connection.connectSpans(this.method)
  }

  disconnect() {
    this.connection.disconnect()
  }

  createMetrics() {
    this._metrics.getOrCreateMetric(NAMES.QUEUE_CAPACITY).recordValue(this.queue_size)
    this._metrics.getOrCreateMetric(NAMES.QUEUE_SIZE).recordValue(this.spans.length)
  }
}

module.exports = BaseSpanStreamer
