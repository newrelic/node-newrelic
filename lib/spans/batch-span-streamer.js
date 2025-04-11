/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'batch-span-streamer' })
const BaseSpanStreamer = require('./base-span-streamer')

class BatchSpanStreamer extends BaseSpanStreamer {
  constructor(licenseKey, connection, metrics, queueSize, batchSize) {
    super(licenseKey, connection, metrics, queueSize)
    this.sendTimer = null
    this.batchSize = batchSize
    this.queueInterval = 5000
  }

  addToQueue(span) {
    this.spans.push(span.toStreamingFormat())
  }

  /* Accepts a span and either writes it to the stream, queues it to be sent,
   * or drops it depending on stream/queue state
   */
  write(span) {
    const currTime = Date.now()

    if (!this.time) {
      this.time = currTime
    }
    super.write(span)

    if (!this._writable) {
      return
    }

    this.addToQueue(span)

    if (this.batchReady(currTime)) {
      this.sendQueue()
      this.time = currTime
    }
  }

  /**
   *  The Infinite Tracing trace observer will treat spans that are more than 10 seconds apart as not belonging to the same group.
   *  It is therefore recommended that the agent perform a RecordSpanBatch request when either a target maximum batch size is reached or 5 seconds have elapsed since the creation of a batch (giving precedence to whichever of these events takes place first).
   *  Otherwise, delayed recording of spans will lead to their being discarded.
   *
   * @param {number} currTime timestamp in milliseconds
   * @returns {boolean} if a batch can we sent
   */
  batchReady(currTime) {
    return this.spans.length >= this.batchSize || currTime - this.time >= this.queueInterval
  }

  /**
   * Chunks the span queue into n per batch.
   * The avg span is generally 1kb, picking an option slightly under to avoid
   * being over 1MB uncompressed limit being imposed on the gRPC server.
   * Since the processing happens async it'll be very hard to split further
   * if a span batch is too big. We are being conservative here and other
   * language agents transmit even smaller batches(100 per batch).
   */
  sendQueue() {
    if (!this.spans.length) {
      logger.trace('Queue is empty, not sending spans.')
      return
    }

    while (this.spans.length > 0 && this._writable) {
      const spans = this.spans.splice(0, this.batchSize)
      logger.trace('Sending spans from queue: %s', spans.length)
      this.send({ spans })
    }

    logger.trace('Finished sending spans from queue. Items left in queue: %s', this.spans.length)
  }
}

module.exports = BatchSpanStreamer
