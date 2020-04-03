'use strict'

const logger = require('../logger').child({component: 'span-streamer'})
const GrpcConnection = require('../grpc/connection')

const NO_STREAM_WARNING =
  'Attempting to stream spans before connection created. ' +
  'This warning will not appear again this agent run.'

const BACK_PRESSURE_WARNING =
  'Back pressure detected in SpanStreamer! Spans will be dropped until the current batch ' +
  'has fully sent. Will not warn again for %s seconds.'
const BACK_PRESSURE_WARNING_INTERVAL = 60 // in seconds

const BACK_PRESSURE_STOP = 'Back pressure has ended, continuing to stream'

class SpanStreamer {
  constructor(endpoint, license_key, connection = new GrpcConnection()) {
    this.stream = null
    this.endpoint = endpoint
    this.license_key = license_key
    this.connection = connection
    this._writable = false
  }

  write(span) {
    if (!this.stream) {
      logger.warnOnce(NO_STREAM_WARNING)
      return false
    }

    if (!this._writable) {
      return false
    }

    const formattedSpan = span.toStreamingFormat()

    try {
      const canKeepWriting = this.stream.write(formattedSpan)

      if (!canKeepWriting) {
        logger.infoOncePer(
          'BACK_PRESSURE_START',
          BACK_PRESSURE_WARNING_INTERVAL * 1000,
          BACK_PRESSURE_WARNING,
          BACK_PRESSURE_WARNING_INTERVAL
        )
        this._writable = false
        this.stream.once('drain', () => {
          logger.trace(BACK_PRESSURE_STOP)
          this._writable = true
        })
      }

      // span was added to internal node stream buffer to be sent while draining
      // so we return true even when we should not write anymore afterwards
      return true
    } catch (err) {
      logger.trace('Could not stream span.', err)
      // TODO: something has gone horribly wrong.
      // We may want to log and turn off this aggregator
      // to prevent sending further spans. Maybe even "disable" their creation?
      // or is there a situation where we can recover?

      return false
    }
  }

  connect(agent_run_id) {
    this.stream = this.connection.connectSpans(
      this.endpoint,
      this.license_key,
      agent_run_id
    )
    this._writable = true
  }

  disconnect() {
    // TODO: disconnect/cancel/verb connection here
  }
}

module.exports = SpanStreamer
