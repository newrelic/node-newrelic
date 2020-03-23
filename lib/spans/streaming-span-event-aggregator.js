'use strict'

const logger = require('../logger')
const EventAggregator = require('../aggregators/event-aggregator')
const StreamingSpanEvent = require('./streaming-span-event')
const NAMES = require('../metrics/names')

const grpc = require('../proxy/grpc')
const protoLoader = require('@grpc/proto-loader')

class StreamingSpanEventAggregator extends EventAggregator {
  constructor(opts, collector, metrics) {
    // opts = opts || {}
    // opts.method = opts.method || 'span_event_data'
    // opts.metricNames = opts.metricNames || NAMES.SPAN_EVENTS
    opts.metricNames = opts.metricNames || NAMES.SPAN_EVENTS
    opts.periodMs = opts.periodMs ? opts.periodMs : 1000
    opts.limit = opts.limit ? opts.limit : 10000
    const packageDefinition = protoLoader.loadSync(
      __dirname + '../../../lib/config/mtb-v1.proto',

      // TODO/APPOLOGIES: what do these even mean?
      {keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      })

    const mtb = grpc.loadPackageDefinition(packageDefinition).com.newrelic.trace.v1
    const client = new mtb.IngestService(
      opts.endpoint,
      grpc.credentials.createSsl()
    )

    const metadata = new grpc.Metadata()
    metadata.add('api_key',opts.api_key)
    super(opts, collector, metrics)

    this.client = client
    this.clientMetaData = metadata
    this.stream = this.client.recordSpan(this.clientMetaData)
    this.spansSent = 0

    // this is an example of listening for
    // messages _from_ the GRPC endpoint
    // this.stream.on('data', function data(response) {
    //   console.log("FROM NEWRELIC: " + JSON.stringify(response))
    // })

    // this is some cheap console logging of the total number of
    // spans send.  Doesn't belong in final prodice
    const report = (() => {
      // console.log('Streamed ' + this.spansSent + ' spans total')
    }).bind(this)
    setInterval(report, 1000)
  }

  start() {
    logger.debug('starting StreamingSpanEventAggregator')
    return super.start()
  }

  send() {
    // START: old proirity queue based span sending
    //        this is left over code from our earliest
    //        prototype where we used normal aggregation, but
    //        with a one second timeout
    for (const [, span] of this._items.toArray().entries()) {
      const result = this.stream.write(span)
      if (!result) {
        // console.log('this.stream.write returned false, what do i do? Back preasure.')
      }
      this.spansSent++
    }
    // END: old proirity queue based span sending

    // TODO/APPOLOGIES: do we ever need to end the stream?
    // stream.end()

    this.clearEvents()
  }

  /**
   * Attempts to add the given segment to the collection.
   *
   * @param {TraceSegment}  segment         - The segment to add.
   * @param {string}        [parentId=null] - The GUID of the parent span.
   *
   * @return {bool} True if the segment was added, or false if it was discarded.
   */
  addSegment(segment, parentId, isRoot) {
    const span = StreamingSpanEvent.fromSegment(segment, parentId, isRoot)
    this.sendSpan(span)
  }

  sendSpan(span) {
    const formattedSpan = span.toStreamingFormat()

    const canKeepWriting = this.stream.write(formattedSpan)
    this.spansSent++

    if (!canKeepWriting) {
      // TODO: handle backpressure
      // Not supposed to write anymore. Can resume after drain completion/event.
    }
  }
}

module.exports = StreamingSpanEventAggregator
