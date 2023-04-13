/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'batch-span-streamer' })
const BaseSpanStreamer = require('./base-span-streamer')

class BatchSpanStreamer extends BaseSpanStreamer {
  constructor(licenseKey, connection, metrics, queueSize) {
    super(licenseKey, connection, metrics, queueSize)
    this.sendTimer = null
    this.batchSize = 750
    this.connection.on('connected', () => {
      logger.debug('Setting up batch interval')
      this.sendTimer = setInterval(this.sendQueue.bind(this), 5000)
      this.sendTimer.unref()
    })

    this.connection.on('disconnected', () => {
      logger.debug('Clearing batch interval')
      if (this.sendTimer) {
        clearInterval(this.sendTimer)
      }
    })
  }

  addToQueue(span) {
    this.spans.push(span.toStreamingFormat())
  }

  /* Accepts a span and either writes it to the stream, queues it to be sent,
   * or drops it depending on stream/queue state
   */
  write(span) {
    super.write(span)

    if (!this._writable) {
      return
    }

    if (this.spans.length < this.queue_size) {
      this.addToQueue(span)
      return
    }

    this.sendQueue()
  }

  /**
   * Chunks the span queue into n per batch(currently at 750).
   * We need to do this to avoid the 1MB uncompressed limit being
   * imposed on the gRPC server.  Since the processing happens async
   * it'll be hvery hard to split further if a 500 span batch is too big.
   * We are being conservative here and other language agents transmit
   * even smaller batches(100 per batch).
   */
  sendQueue() {
    if (!this.spans.length) {
      logger.trace('Queue is empty, not sending spans.')
      return
    }

    for (let i = 0; i < this.spans.length; i += this.batchSize) {
      const spans = this.spans.slice(i, i + this.batchSize)
      logger.trace('Sending spans from queue: %s', spans.length)
      this.send({ spans }, spans.length)
    }

    this.spans = []

    logger.trace('Finished sending spans from queue. Items left in queue: %s', this.spans.length)
  }
}

module.exports = BatchSpanStreamer
