/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'TraceContext' })
const hashes = require('../util/hashes')

const Traceparent = require('../w3c/traceparent')
const Tracestate = require('../w3c/tracestate')
const TracestateIntrinsics = require('../w3c/tracestate-intrinsics')

const TRACE_CONTEXT_PARENT_HEADER = 'traceparent'
const TRACE_CONTEXT_STATE_HEADER = 'tracestate'
const FLAGS = {
  sampled: 0x00000001
}

/**
 * The class responsible for accepting, validating, and producing w3c tracecontext headers.
 */
class TraceContext {
  /**
   * Create a TraceContext object
   *
   * @param {Transaction} transaction - a transaction object to attach to.
   */
  constructor(transaction) {
    this.transaction = transaction
    this.tracingVendors = null
    this.trustedParentId = null
    this._traceStateRaw = null
    this.flags = {
      get sampled() {
        return transaction.sampled
      }
    }
  }

  /**
   * @param {object} spanContext if passed in, it'll use this to construct traceparent. only used in otel bridge mode.
   * @returns {string} a W3C TraceContext traceparent header payload.
   */
  createTraceparent(spanContext) {
    if (spanContext) {
      const traceparent = Traceparent.fromSpanContext(spanContext)
      return traceparent.toString()
    }

    // In case we receive a trace ID that isn't the proper length, zero pad
    let traceId = this.transaction.traceId.toLowerCase()
    traceId = traceId.padStart(32, '0')

    // If no segment/span is in context, generate one so we can have a valid traceparent
    const segment = this.transaction.agent.tracer.getSegment()
    let parentId = segment && segment.id
    if (!parentId) {
      parentId = hashes.makeId(16)
      logger.debug(
        'No segment/span in context. Generated new traceparent parentId (%s) for traceId (%s)',
        parentId,
        traceId
      )
    }

    const traceparent = new Traceparent({ traceId, parentId, flags: this.createFlagsHex() })
    return traceparent.toString()
  }

  /**
   * Creates a W3C TraceContext tracestate header payload.
   *
   * @param {object} spanContext if passed in, it'll use this to construct tracestate. only used in otel bridge mode.
   * @returns {string} tracestate, a hyphen-delimited string of trace information fields
   */
  createTracestate(spanContext) {
    const config = this.transaction.agent.config
    const trustedAccountKey = config.trusted_account_key
    const version = Tracestate.NR_TRACESTATE_VERSION
    const parentType = TracestateIntrinsics.PARENT_TYPES.indexOf('App')
    const appId = config.primary_application_id
    const accountId = config.account_id

    if (!accountId || !appId || !trustedAccountKey) {
      logger.debug(
        'Unable to create tracestate header due to missing required fields ' +
          '(account_id: %s, primary_application_id: %s, trusted_account_key: %s) in transaction %s' +
          'This may occur if a trace is created prior to the agent fully starting.',
        accountId,
        appId,
        trustedAccountKey,
        this.transaction.id
      )

      this.transaction.agent.recordSupportability('TraceContext/TraceState/Create/Exception')

      return this._traceStateRaw || ''
    }

    // If no segment/span is in context, we do not send one as
    // we technically do not have a "span" on the agent side and
    // this trace data is newrelic specific.
    let spanId = ''
    if (config.span_events.enabled) {
      const segment = spanContext?.spanId ? { id: spanContext.spanId } : this.transaction.agent.tracer.getSegment()
      if (segment) {
        spanId = segment.id
      } else {
        logger.debug('No segment/span in context. Not sending spanId in tracestate.')
      }
    } else {
      logger.trace('Span events disabled. Not sending spanId in tracestate.')
    }

    const transactionId = config.transaction_events.enabled ? this.transaction.id : ''
    const sampled = this.transaction.sampled ? '1' : '0'
    const priority = this.transaction.priority ? this.transaction.priority.toFixed(6) : ''
    const timestamp = Date.now()

    const nrTraceState =
      `${trustedAccountKey}@nr=${version}-${parentType}-${accountId}` +
      `-${appId}-${spanId}-${transactionId}-${sampled}-${priority}-${timestamp}`

    if (this._traceStateRaw) {
      return `${nrTraceState},${this._traceStateRaw}`
    }

    return nrTraceState
  }

  /**
   * Takes a headers object and modifies it in place by adding Trace Context headers
   *
   * @param {object} headers - Headers for an HTTP request
   * @param {object} setter - otel bridge setter to assign headers to outgoing payload. Doing this instead of assigning to headers because some libraries have special logic for handling outgoing headers(gcp-pubsub)
   * @param {object} spanContext if passed in, it'll use this to construct traceparent/tracestate. only used in otel bridge mode.
   */
  addTraceContextHeaders(headers, setter, spanContext) {
    if (!headers) {
      return
    }

    const traceParent = this.createTraceparent(spanContext)
    if (setter) {
      setter.set(headers, TRACE_CONTEXT_PARENT_HEADER, traceParent)
    } else {
      headers[TRACE_CONTEXT_PARENT_HEADER] = traceParent
    }

    logger.trace('traceparent added with %s', traceParent)

    const tracestate = this.createTracestate(spanContext)
    if (tracestate) {
      if (setter) {
        setter.set(headers, TRACE_CONTEXT_STATE_HEADER, tracestate)
      } else {
        headers[TRACE_CONTEXT_STATE_HEADER] = tracestate
      }
      logger.trace('tracestate added with %s', tracestate)
    }

    this.transaction.agent.recordSupportability('TraceContext/Create/Success')
  }

  /**
   * Takes a TraceContext headers from an HTTP request, parses them, validates them, and
   * applies the values to the internal state, returning an object with the
   * relevant Trace Context data and validation information.
   *
   * @param {string} traceparentHeader - W3C traceparent header from an HTTP request
   * @param {string} tracestateHeader - W3C tracestate header from an HTTP request
   * @returns {object} returns an Object with the traceparent data and validation info
   */
  acceptTraceContextPayload(traceparentHeader, tracestateHeader) {
    const result = { traceparent: undefined, tracestate: undefined }
    if (!traceparentHeader) {
      // From the W3C spec: If the vendor failed to parse traceparent, it MUST NOT
      // attempt to parse tracestate.
      // See https://www.w3.org/TR/trace-context/#no-traceparent-received.
      return result
    }

    let traceparent
    try {
      traceparent = Traceparent.fromHeader(traceparentHeader)
    } catch (error) {
      logger.trace('Invalid traceparent for transaction %s: %s', this.transaction.id, traceparentHeader)
      logger.error('Traceparent parse error: %s', error.message)
      this.transaction.agent.recordSupportability('TraceContext/TraceParent/Parse/Exception')
      return result
    }
    result.traceparent = traceparent
    logger.trace('Accepted traceparent for transaction %s', this.transaction.id)

    let tracestate
    try {
      tracestate = Tracestate.fromHeader({ header: tracestateHeader, agent: this.transaction.agent })
    } catch (error) {
      logger.trace('Invalid tracestate for transaction %s: %s', this.transaction.id, tracestateHeader)
      logger.error('Tracestate parse error: %s', error.message)
      this.transaction.agent.recordSupportability('TraceContext/TraceState/Parse/Exception')
      return result
    }
    result.tracestate = tracestate

    // Keep the raw, non-NewRelic tracestate string stored so that we can propagate it
    this._traceStateRaw = tracestate.toString()
    // These need to be kept to be added to root span events as an attribute
    this.tracingVendors = tracestate.vendors

    if (tracestate.intrinsics && tracestate.intrinsics.version !== TracestateIntrinsics.NR_TRACESTATE_VERSION) {
      logger.trace(
        'Incoming tracestate version: %s, agent tracestate version: %s',
        tracestate.intrinsics.version,
        TracestateIntrinsics.NR_TRACESTATE_VERSION
      )
    }

    if (tracestate.intrinsics?.isValid === false) {
      logger.error('Invalid tracestate for transaction %s: %s', this.transaction.id, tracestateHeader)
      this.transaction.agent.recordSupportability('TraceContext/TraceState/InvalidNrEntry')
      return result
    }

    // We have to set the trustedParentId _after_ verifying the intrinsics are
    // valid because the cross agent distributed tests do not expect this
    // property to be set if the intrinsics are invalid.
    this.trustedParentId = tracestate.spanId

    logger.trace('Accepted tracestate for transaction %s', this.transaction.id)
    this.transaction.agent.recordSupportability('TraceContext/Accept/Success')

    return result
  }

  // Not used now, but will be useful when traceparent has more flags
  parseFlagsHex(flags) {
    const flagsInt = parseInt(flags, 16)
    return Object.keys(FLAGS).reduce((o, key) => {
      o[key] = Boolean(flagsInt & FLAGS[key])
      return o
    }, {})
  }

  createFlagsHex() {
    const flagsNum = Object.keys(this.flags).reduce((num, key) => {
      if (this.flags[key]) {
        num += FLAGS[key]
      }
      return num
    }, 0)
    return flagsNum.toString(16).padStart(2, '0')
  }
}

module.exports.TraceContext = TraceContext
module.exports.TRACE_CONTEXT_PARENT_HEADER = TRACE_CONTEXT_PARENT_HEADER
module.exports.TRACE_CONTEXT_STATE_HEADER = TRACE_CONTEXT_STATE_HEADER
