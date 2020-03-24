'use strict'

const EventAggregator = require('../aggregators/event-aggregator')
const SpanEvent = require('./span-event')
const NAMES = require('../metrics/names')

class StreamingSpanEventAggregator extends EventAggregator {
  constructor(opts, collector, metrics) {
    opts = opts || {}
    opts.metricNames = opts.metricNames || NAMES.SPAN_EVENTS
    opts.periodMs = opts.periodMs ? opts.periodMs : 1000
    opts.limit = opts.limit ? opts.limit : 10000
    opts.method = opts.method || 'span_event_data'
    super(opts, collector, metrics)
    this.agent = opts.agent
    this.stream = opts.span_streamer
  }
  start() {
    this.stream.connect(this.agent.config.run_id)
  }

  stop() {
    this.stream.disconnect()
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
    super.send()
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
   *
   * @return {bool} True if the segment was added, or false if it was discarded.
   */
  addSegment(segment, parentId, isRoot) {
    // TODO/APPOLOGIES: for the prototype, we converting the incoming
    //                  segment into a span using the existing method
    //                  and then used data from the span to crete the
    //                  simple obect expected by grpc/protobuffs
    //                  dynamic code generation
    const collectorSpan = SpanEvent.fromSegment(segment, parentId || null, isRoot)

    // TODO/APPOLOGIES: Should pull app name from config.  We need to
    //                  have this set for MTB to accept our spans
    // const appOrServiceName = 'Node MTB JAM'
    const intrinsics = {
      'appName': {
        'string_value': 'Node MTB JAM'
      },
      'service.name': {string_value:'Node MTB JAM'}
    }

    // TODO/APPOLOGIES: goes through each intrinsic on the span and
    //                  and creates the {type_value: value} intrinsics
    //                  object needed for dynamic code generation.
    //                  We still need to do this for agent attributes and
    //                  custom attributes, and probably an
    //                  mapIntrinsicsToMtbProto that works without knowing keys
    for (let [key, value] of Object.entries(collectorSpan.intrinsics)) {
      // TODO: In our standard code paths, spans are serialized via .toJSON()
      // this will filter nulls added to attributes. We will want/need to ensure
      // the same happens for streaming spans

      intrinsics[key] = this.mapIntrinsicsToMtbProto(key, value)
    }

    // TODO/APPOLOGIES: our "dynamic code generation" object for
    //                  protobuff/grpc -- won't actually work with those
    //                  Map objects.
    const span = {
      trace_id: collectorSpan.intrinsics.traceId,
      intrinsics: intrinsics,
      user_attributes: new Map(),
      agent_attributes: new Map(),
    }

    // TODO/APPOLOGIES: This callback streams the span.  Once defined, we
    //                  schedule the callback on the event loop via a 0 length
    //                  set timeout.  Should this be nextTick or setImmediate?
    //                  unsure if that would block, even if for a ms, the event
    //                  loop.  We should research that.
    const sendSpan = (() => {
      this.spansSent++
      const result = this.stream.write(span)
      if (!result) {
        // console.log('this.stream.write returned false, what do i do? Back preasure.')
      }
    }).bind(this)

    // schedule callback for next event loop tick
    setTimeout(sendSpan, 0)

    return
  }

  // TODO/APPOLOGIES: as mentioned above, this serializes our span attributes
  //                  for dynamic code generation.
  mapIntrinsicsToMtbProto(key, value) {
    switch (key) {
      case 'type':
      case 'traceId':
      case 'guid':
      case 'parentId':
      case 'transactionId':
      case 'name':
      case 'category':
      case 'component':
      case 'span.kind':
      case 'trustedParentId':
      case 'tracingVendors':
      case 'error.name':
      case 'error.message':
        return {
          'string_value': value
        }
      case 'timestamp':
        return {
          'int_value': value
        }
      case 'sampled':
      case 'nr.entryPoint':
        return {
          'bool_value': value
        }
      case 'priority':
      case 'duration':
        return {
          'double_value': value
        }
      default:
        return
    }
  }
}

module.exports = StreamingSpanEventAggregator
