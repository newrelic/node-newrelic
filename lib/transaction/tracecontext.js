'use strict'

const hashes = require('../util/hashes')
const TRACE_CONTEXT_PARENT_HEADER = 'traceparent'
const TRACE_CONTEXT_STATE_HEADER = 'tracestate'
const parentTypes = ['App', 'Browser', 'Mobile']

const FLAGS = {
  sampled: 0x00000001
}

class TraceContext {
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
    this._traceStateRaw
    this._traceStateIntrinsics
  }

  get parentId() {
    // If spans enabled, use the segment ID
    if (!this._parentId && this.transaction.agent.config.span_events.enabled) {
      this._parentId = this.transaction.agent.tracer.getSegment().id
    }

    // Generate a new ID if spans are not enabled
    if (!this._parentId) {
      this._parentId = hashes.makeId()
    }

    this._parentId = this._parentId.padStart(16, '0')
    return this._parentId
  }

  get traceId() {
    if (!this._traceId) {
      this._traceId = (hashes.makeId() + hashes.makeId()).padStart(32, '0')
    }
    return this._traceId
  }

  get traceparent() {
    return `${this.version}-${this.traceId}-${this.parentId}-${this.createFlagsHex()}`
  }

  get tracestate() {
    const config = this.transaction.agent.config
    const trustedAccountKey = config.trusted_account_key
    const version = '0'
    const parentType = '0'  // '0' is App, which node agent will always be
    const appId = config.primary_application_id
    const accountId = config.account_id
    const spanId = this.transaction.agent.tracer.getSegment().id
    const transactionId = this.transaction.id
    const sampled = this.transaction.sampled ? '1' : '0'
    const priority = this.transaction.priority ? this.transaction.priority.toFixed(6) : ''
    const timestamp = Date.now()

    const nrTraceState = `${trustedAccountKey}@nr=${version}-${parentType}-${accountId}` +
      `-${appId}-${spanId}-${transactionId}-${sampled}-${priority}-${timestamp}`

    if (this._traceStateRaw) {
      return `${nrTraceState},${this._traceStateRaw}`
    }

    return nrTraceState
  }

  createTraceContextPayload() {
    this.transaction._calculatePriority()
    return {
      [TRACE_CONTEXT_PARENT_HEADER]: this.traceparent,
      [TRACE_CONTEXT_STATE_HEADER]: this.tracestate
    }
  }

  addTraceContextHeaders(headers) {
    // This gets the transaction object to calculate priority and set the sampled property
    const traceContextHeaders = this.createTraceContextPayload()
    Object.assign(headers, traceContextHeaders)
  }

  acceptTraceContextPayload(traceparent, tracestate) {
    // logger.trace(
    //   'Accepting trace context payload for transaction %s',
    //   transaction.id
    // )
    if (!traceparent)
      return

    const parsedParent = this._validateTraceParentHeader(traceparent)

    if (parsedParent) {
      this.version = parsedParent.version
      this._traceId = parsedParent.traceId
      this._parentId = parsedParent.parentId
      // Ignore the sampled flag for now
      // this.flags = this.parseFlagsHex(parsed.flags)
    }

    const parsedState = this._validateTraceStateHeader(tracestate)

    if (parsedState) {
      this._traceStateRaw = parsedState.newTraceState
      this._traceStateIntrinsics = parsedState.intrinsics
    }
  }

  _validateTraceParentHeader(traceparent) {
    // eslint-disable-next-line max-len
    const namedRgx = /^([a-f0-9]{2})-((?![0]{32})[a-f0-9]{32})-((?![0]{16})[a-f0-9]{16})-([a-f0-9]{2})$/
    const match = traceparent.match(namedRgx)
    if (match) {
      const matchNames = {
        version: match[1],
        traceId: match[2],
        parentId: match[3],
        flags: match[4]
      }
      return matchNames
    }
    return false
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

  _validateTraceStateHeader(tracestate) {
    const keyVals = tracestate.split(',')

    let entryFound = false
    let entryValid = false
    let intrinsics = undefined
    let newTraceState = undefined

    // See if there's a New Relic Trace State
    const trustedKey = this.transaction.agent.config.trusted_account_key
    const nrVendorIndex = keyVals.findIndex((vendor) => {
      return vendor.startsWith(`${trustedKey}@nr`)
    })
    if (nrVendorIndex >= 0) {
      entryFound = true

      // Remove the new relic entry that we found from the trace state key vals array
      const nrTraceStateString = keyVals.splice(nrVendorIndex, 1)[0]
      const nrTraceStateValue = nrTraceStateString.split('=')[1]

      intrinsics = this._validateAndParseIntrinsics(nrTraceStateValue)
      if (intrinsics) {
        entryValid = true
      } else {
        entryValid = false
      }
    }

    // Rebuild the new strace state string without the new relic entry
    newTraceState = keyVals.join(',')

    return {
      entryFound,
      entryValid,
      intrinsics,
      newTraceState
    }
  }

  _validateAndParseIntrinsics(nrIntrinsics) {
    const intrinsics = this._extractTraceStateIntrinsics(nrIntrinsics)
    // version
    const version = parseInt(intrinsics.parentType, 10)
    if (intrinsics.version !== '0' || version === NaN) return false
    intrinsics.version = version

    // parentType
    const parentTypeId = parseInt(intrinsics.parentType, 10)
    if (isNaN(parentTypeId)) return false
    intrinsics.parentType = parentTypeId

    if (parentTypes[parentTypeId] === undefined) return false

    // account ID
    if (intrinsics.accountId === '') return false

    // app ID
    if (intrinsics.appId === '') return false

    // sampled
    if (intrinsics.sampled !== undefined) {
      const sampled = parseInt(intrinsics.sampled, 10)
      if (isNaN(sampled)) return false
      if (sampled < 0 || sampled > 1) return false
      intrinsics.sampled = sampled
    }

    // priority
    if (intrinsics.priority !== undefined) {
      const priority = parseFloat(intrinsics.priority)
      if (isNaN(priority)) return false
      intrinsics.priority = priority
    }

    // timestamp
    const timestamp = parseInt(intrinsics.timestamp, 10)
    if (isNaN(timestamp)) return false
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
      sampled: intrinsics[6],
      priority: intrinsics[7],
      timestamp: intrinsics[8]
    }

    return intrinsicsObject
  }
}

module.exports.TraceContext = TraceContext
module.exports.TRACE_CONTEXT_PARENT_HEADER = TRACE_CONTEXT_PARENT_HEADER
module.exports.TRACE_CONTEXT_STATE_HEADER = TRACE_CONTEXT_STATE_HEADER
