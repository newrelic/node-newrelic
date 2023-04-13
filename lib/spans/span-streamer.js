/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'span-streamer' })
const BaseSpanStreamer = require('./base-span-streamer')

class SpanStreamer extends BaseSpanStreamer {
  constructor(licenseKey, connection, metrics, queueSize) {
    super(licenseKey, connection, metrics, queueSize)
  }

  addToQueue(span) {
    this.spans.push(span)
  }

  /* Accepts a span and either writes it to the stream, queues it to be sent,
   * or drops it depending on stream/queue state
   */
  write(span) {
    super.write(span)

    if (!this._writable) {
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

  sendQueue() {
    if (!this.spans.length) {
      logger.trace('Queue is empty, not sending spans.')
      return
    }

    logger.trace('Sending spans from queue: %s.', this.spans.length)

    // Continue sending the spans that were in the queue. _writable is checked
    // so that if a send fails while clearing the queue, this drain handler can
    // finish, and the drain handler setup on the failed send will then attempt
    // to clear the queue
    while (this.spans.length > 0 && this._writable) {
      const nextObject = this.spans.shift()
      this.send(nextObject.toStreamingFormat())
    }

    logger.trace('Finished sending spans from queue. Items left in queue: %s', this.spans.length)
  }
}

module.exports = SpanStreamer
