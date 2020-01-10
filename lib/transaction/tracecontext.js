'use strict'

const hashes = require('../util/hashes')
const TRACE_CONTEXT_PARENT_HEADER = 'traceparent'

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
    this.version = 0
    this.flags = { sampled: transaction.sampled }
    this.traceId = ''
    this.state = {}
    this.transaction = transaction
    this.parentType = 0
  }

  get parentId() {
    // generate new id if spans !enabled 
    return (this.transaction.agent.config.span_events.enabled ? 
      this.transaction.agent.tracer.getSegment().id :
      hashes.makeId()
    ).padStart(16, '0')
  }

  get traceparent() {
    const version = this.version.padStart(2, '0')
    const parentId = this.parentId.padStart(16, '0')
    const traceId = this.traceId.padStart(32, '0')
    const flags = this.createFlagsHex()
    return `${version}-${traceId}-${parentId}-${flags}`
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
  acceptTraceContextHeader(header) {
    const parsed = this._validateTraceParentHeader(header)
    if (parsed) {
      this.version = parseInt(parsed.version, 16)
      this.traceId = parsed.traceId
      this.parentId = parsed.parentId
      this.flags = this.parseFlagsHex(parsed.flags) 
      this.parseTraceParent()
    }
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

  getTraceContextHeaders() {}

  _validateTraceParentHeader(header) {
    /* eslint-disable max-len */
    const namedRgx = /^(?<version>[a-f0-9]{2})-(?<traceId>(?![0]{32})[a-f0-9]{32})-(?<parentId>(?![0]{16})[a-f0-9]{16})-(?<flags>[a-f0-9]{2})$/
    const match = header.match(namedRgx)
    if (match) {
      return match.groups
    }
    return false
  }
	
  createTraceParent() {
    const version = this.version.padStart(2, '0')
    let parentId = this.transaction.agent.config.span_events.enabled ? 
      this.transaction.agent.tracer.getSegment().id :
      hashes.makeId() // generate new id if spans !enabled 
    const sampled = this.transaction.sampled ? '01' : '00'
  

    this.traceparent
      = `${version}-${this.traceId.padStart(32, '0')}-${parentId}-${sampled}`
  }
}
