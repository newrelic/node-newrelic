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
      this.stream = stream
      this._writable = true
    })

    this.connection.on('disconnected', () =>{
      this.stream = null
      this._writable = false
    })
  }

  /**
   *  Write to queue or stream, whichever is best
   */
  write(span) {
    if (!this.stream) {
      logger.warnOnce(NO_STREAM_WARNING)
      return
    }

    if (!this._writable) {
      if (this.spans.length <= this.queue_size) {
        this.spans.push(span)
        return
      }

      this._metrics.getOrCreateMetric('Supportability/InfiniteTracing/Span/Dropped')
        .incrementCallCount()
      return
    }

    const formattedSpan = span.toStreamingFormat()

    try {
      this.send(formattedSpan)
    } catch (err) {
      logger.error('Could not stream span.', err)
      // TODO: something has gone horribly wrong.
      // We may want to log and turn off this aggregator
      // to prevent sending further spans. Maybe even "disable" their creation?
      // or is there a situation where we can recover?
    }
  }

  /**
   *  Send to the stream
   */
  send(span) {
    // false indicates the stream has reached the highWaterMark
    // and future writes should be avoided until drained. written items,
    // including the one that returned false, will still be buffered.
    this._writable = this.stream.write(span)
    this._metrics.getOrCreateMetric(NAMES.SENT).incrementCallCount()

    if (!this._writable) {
      logger.infoOncePer(
        'BACK_PRESSURE_START',
        BACK_PRESSURE_WARNING_INTERVAL * 1000,
        BACK_PRESSURE_WARNING,
        BACK_PRESSURE_WARNING_INTERVAL
      )

      const waitDrainStart = Date.now()
      const drain = this.onDrain.bind(this, waitDrainStart)
      this.stream.once('drain', drain)
    }

    return this._writable
  }

  onDrain(waitDrainStart) {
    const drainCompleted = Date.now()
    const drainDurationMs = drainCompleted - waitDrainStart

    // Metric can be used to see how frequently completing drains
    // as well as average time to drain from when we first notice.
    this._metrics.getOrCreateMetric(NAMES.INFINITE_TRACING.DRAIN_DURATION)
      .recordValue(drainDurationMs / 1000)

    logger.trace(BACK_PRESSURE_STOP)
    this._writable = true

    // If the previous send or some other call to write/send caused writable to
    // become false, then this drain function can stop, and the other one that
    // was setup will continue sending spans
    while (this.spans.length > 0 && this._writable) {
      const nextObject = this.spans.shift()
      this.send(nextObject)
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
