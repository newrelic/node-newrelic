'use strict'

const logger = require('../logger').child({component: 'span-streamer'})

const NAMES = require('../metrics/names')

const NO_STREAM_WARNING =
  'Attempting to stream spans before connection created. ' +
  'This warning will not appear again this agent run.'

const BACK_PRESSURE_WARNING =
  'Back pressure detected in SpanStreamer! Spans will be dropped until the current batch ' +
  'has fully sent. Will not warn again for %s seconds.'
const BACK_PRESSURE_WARNING_INTERVAL = 60 // in seconds

const BACK_PRESSURE_STOP = 'Back pressure has ended, continuing to stream'

class SpanStreamer {
  constructor(license_key, connection, metrics) {
    this.stream = null
    this.license_key = license_key
    this.connection = connection
    this._metrics = metrics
    this._writable = false

    // 'connected' indicates a safely writeable stream.
    // May still be mid-connect to gRPC server.
    this.connection.on('connected', (stream) =>{
      this.stream = stream
      this._writable = true
    })

    this.connection.on('disconnected', () =>{
      this.stream = null
      this._writable = false
    })
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
      // false indicates the stream has reached the highWaterMark
      // and future writes should be avoided until drained. written items,
      // including the one that returned false, will still be buffered.
      this._writable = this.stream.write(formattedSpan)

      if (!this._writable) {
        logger.infoOncePer(
          'BACK_PRESSURE_START',
          BACK_PRESSURE_WARNING_INTERVAL * 1000,
          BACK_PRESSURE_WARNING,
          BACK_PRESSURE_WARNING_INTERVAL
        )

        const waitDrainStart = Date.now()

        this.stream.once('drain', () => {
          const drainCompleted = Date.now()
          const drainDurationMs = drainCompleted - waitDrainStart

          // Metric can be used to see how frequently completing drains
          // as well as average time to drain from when we first notice.
          this._metrics.getOrCreateMetric(NAMES.INFINITE_TRACING.DRAIN_DURATION)
            .recordValue(drainDurationMs / 1000)

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
    this.connection.setConnectionDetails(
      this.license_key,
      agent_run_id
    )

    this.connection.connectSpans()
  }

  disconnect() {
    this.connection.disconnect()
  }
}

module.exports = SpanStreamer
