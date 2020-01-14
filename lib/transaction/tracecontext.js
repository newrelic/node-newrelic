'use strict'

const hashes = require('../util/hashes')
const TRACE_CONTEXT_PARENT_HEADER = 'traceparent'
const TRACE_CONTEXT_STATE_HEADER = 'tracestate'

const FLAGS = {
  sampled: 0x00000001
}

module.exports = class TraceContext {
  /**
   * The class reponsible for producing and validating w3c
   * tracecontext headers.
   *
   * @constructor
   */
  constructor(transaction) {
    this.transaction = transaction
    this.version = '00'
    this.flags = { 
      get sampled() {
        return transaction.sampled
      }
    }
    this.state = {}
    this.parentType = 0
    this._parentId
    this._traceId
  }

  get parentId() {
    // If spans enabled use the segment ID
    if (!this._parentId && this.transaction.agent.config.span_events.enabled) {
      this._parentId = this.transaction.agent.tracer.getSegment().id
    }

    // Generate new ID if spans !enabled 
    if (!this._parentId) {
      this._parentId = hashes.makeId()
    }

    this._parentId = this._parentId.padStart(16, '0')
    return this._parentId
  }

  get traceId() {
    if (!this._traceId) {
      this._traceId = hashes.makeId(32).padStart(32, '0')
    }
    return this._traceId
  }

  get traceparent() {
    return `${this.version}-${this.traceId}-${this.parentId}-${this.createFlagsHex()}`
  }

  get tracestate() {
    return 'TODO=true'
  }
  
  // maybe use this when we are looking for and setting header
  static getTraceParentHeaderName() {
    return TRACE_CONTEXT_PARENT_HEADER
  }

  // const accountId = transaction.agent.config.account_id
  // const appId = transaction.agent.config.primary_application_id
  acceptTraceContextHeader(traceparent) {
    const parsed = this._validateTraceParentHeader(traceparent)
    if (parsed) {
      this.version = parsed.version
      this._traceId = parsed.traceId
      this._parentId = parsed.parentId
      this.flags = this.parseFlagsHex(parsed.flags) 
    }
  }

  acceptTraceContextFromHeaders(headers) {
    if (!this.transaction.agent.config.feature_flag.dt_format_w3c)
      return
    
    const traceparent = headers[TRACE_CONTEXT_PARENT_HEADER]
    if (!traceparent) 
      return
      
    // logger.trace(
    //   'Accepting trace context payload for transaction %s',
    //   transaction.id
    // )

    this.acceptTraceContextHeader(traceparent)
  }

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

  _validateTraceParentHeader(traceparent) {
    /* eslint-disable max-len */
    const namedRgx = /^(?<version>[a-f0-9]{2})-(?<traceId>(?![0]{32})[a-f0-9]{32})-(?<parentId>(?![0]{16})[a-f0-9]{16})-(?<flags>[a-f0-9]{2})$/
    const match = traceparent.match(namedRgx)
    if (match) {
      return match.groups
    }
    return false
  }
}
