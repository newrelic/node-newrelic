'use strict'

const hashes = require('../util/hashes')
const TRACE_CONTEXT_PARENT_HEADER = 'traceparent'

module.exports = class TraceContext {
  /**
   * The class reponsible for producing and validating w3c
   * tracecontext headers.
   *
   * @constructor
   */
  constructor(transaction) {
    this.version = 0
    this.flags = { sampled: true }
    this.traceId = ''
    this.parentId = ''
    this.priority = 0
    this.state = {}
    this.transaction = transaction
    this.parentType = 0

    // this will be final header strings
    this.traceparent = ''
    this.tracestate = ''
  }
  
  // maybe use this when we are looking for and setting header
  static getTraceParentHeaderName() {
    return TRACE_CONTEXT_PARENT_HEADER
  }

  // const accountId = transaction.agent.config.account_id
  // const appId = transaction.agent.config.primary_application_id
  acceptTraceContextHeader(header) {
    if (!this.validateTraceParentHeader(header)) {
      this.traceparent = header
      this.parseTraceParent()
    }
  }
  getTraceContextHeaders() {}

  validateTraceParentHeader(header) {
    const rgx 
      = /^[a-f0-9]{2}-(?![0]{32})[a-f0-9]{32}-(?![0]{16})[a-f0-9]{16}-[a-f0-9]{2}$/
    if (header.match(rgx)) return true
    return false
  }
	
  createTraceParent() {
    const version = this.version.padStart(2, '0')
    let parentId = this.transaction.agent.config.span_events.enabled ? 
      this.transaction.agent.tracer.getSegment().id :
      hashes.makeId() // generate new id if spans !enabled 
    const sampled = this.transaction.sampled ? '01' : '00'
  
    parentId = this.parentId.padStart(16, '0')

    this.traceparent
      = `${version}-${this.traceId.padStart(32, '0')}-${parentId}-${sampled}`
  }

  parseTraceParent() {
    // parse traceparent into class properties?
  }

  get traceparent() {
    return this.traceparent
  }

  get tracestate() {
    return this.tracestate
  }
}
