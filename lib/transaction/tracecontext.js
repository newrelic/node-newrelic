'use strict'

const hashes = require('../util/hashes')
const TRACE_CONTEXT_PARENT_HEADER = 'traceparent'
const TRACE_CONTEXT_STATE_HEADER = 'tracestate'
const parentTypes = ['App', 'Browser', 'Mobile']

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
    this.nrTraceState = {

    }
    this.parentType = 0
    this._parentId
    this._traceId
    this.traceStateRawMinusNr
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
  acceptTraceContextParentHeader(traceparent) {
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

    this.acceptTraceContextParentHeader(traceparent)
  }

  // TODO: check if we need to save inbound sampled flags
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

  _validateTraceStateHeader(tracestate) {
    const keyVals = tracestate.split(',')

    const nrVendorIndex = keyVals.findIndex((vendor) => {
      return vendor.includes(`${this.transaction.agent.config.trusted_account_key}@nr`)
    })
    if (nrVendorIndex < 0) return
    
    const [nrTenantId, nrValue] = keyVals.splice(nrVendorIndex, 1)[0].split('=')
    
    this.traceStateRawMinusNr = keyVals.join(',')
    
    const trustedAccountId = nrTenantId.substr(0, nrTenantId.indexOf('@'))

    if (trustedAccountId !== this.transaction.agent.config.trusted_account_key)
      return false

    let intrinsics = this._validateAndParseIntrinsics(nrValue)

    if (intrinsics) {
      this.nrTraceState = intrinsics
    } else {
      return false
    }

    return true
  }

  _validateAndParseIntrinsics(nrIntrinsics) {
    const intrinsics = this._extractTraceStateIntrinsics(nrIntrinsics)

    // version
    if (intrinsics.version !== '0')
      return false

    // parentType
    const parentTypeId = parseInt(intrinsics.parentType, 10)
    if (parentTypeId === NaN)
      return false
    intrinsics.parentType = parentTypeId

    if (parentTypes[parentTypeId] === undefined)
      return false

    if (intrinsics.accountId === '')
      return false

    if (intrinsics.appId === '')
      return false

    if (intrinsics.sampled !== undefined) {
      const sampled = parseInt(intrinsics.sampled, 10)

      if (sampled === NaN)
        return false

      if (sampled < 0 || sampled > 1) {
        return false
      }

      intrinsics.sampled = sampled
    }

    if (intrinsics.priority !== undefined) {
      const priority = parseFloat(intrinsics.priority)

      if (priority === NaN) return false

      intrinsics.priority = priority
    }

    const timestamp = parseInt(intrinsics.timestampj, 10)

    if (timestamp === NaN) return false
    
    intrinsics.timestamp = timestamp

    return intrinsics
  }

  _extractTraceStateIntrinsics(value) {
    const intrinsics = value.split('-')

    const intrinsicsObject = {
      version: intrinsics[0],
      parentType: intrinsics[1],
      accountId: intrinsics[2],
      appId: intrinsics[3],
      spanId: intrinsics[4],
      transactionId: intrinsics[5],
      sampled: parseInt(intrinsics[6], 10),
      priority: intrinsics[7],
      timestamp: intrinsics[8]
    }

    return intrinsicsObject
  }
}
