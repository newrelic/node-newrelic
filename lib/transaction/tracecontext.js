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

    const parsed = this._validateTraceParentHeader(traceparent)

    if (parsed) {
      this.version = parsed.version
      this._traceId = parsed.traceId
      this._parentId = parsed.parentId
      // Ignore the sampled flag for now
      // this.flags = this.parseFlagsHex(parsed.flags)
    }
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

  acceptTraceStateFromHeaders(headers) {
    if (!this.transaction.agent.config.feature_flag.dt_format_w3c)
      return

    const tracestate = headers[TRACE_CONTEXT_STATE_HEADER]
    if (!tracestate)
      return

    // logger.trace(
    //   'Accepting trace state payload for transaction %s',
    //   transaction.id
    // )

    const parsed = this._validateTraceStateHeader(tracestate)

    if (parsed) {
      this._traceStateRaw = parsed.newTraceState
      this._traceStateIntrinsics = parsed.intrinsics
    }
  }

  _validateTraceStateHeader(tracestate) {
    const keyVals = tracestate.split(',')

    let entryFound = false
    let entryValid = false
    let intrinsics = undefined
    let newTraceState = undefined

    // See if there's a New Relic Trace State
    const accountKey = this.transaction.agent.config.trusted_account_key
    const nrVendorIndex = keyVals.findIndex((vendor) => {
      return vendor.startsWith(`${accountKey}@nr`)
    })

    if (nrVendorIndex >= 0) {
      entryFound = true

      // Remove the new relic entry that we found from the trace state key vals array
      const nrTraceStateString = keyVals.splice(nrVendorIndex, 1)[0]
      const nrTraceStateValue = nrTraceStateString.split('=')[1]

      // Rebuild the new strace state string without the new relic entry
      newTraceState = keyVals.join(',')

      intrinsics = this._validateAndParseIntrinsics(nrTraceStateValue)
      if (intrinsics) {
        entryValid = true
      } else {
        entryValid = false
      }
    }

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
      sampled: parseInt(intrinsics[6], 10),
      priority: intrinsics[7],
      timestamp: intrinsics[8]
    }

    return intrinsicsObject
  }
}
