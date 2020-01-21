'use strict'

const logger = require('../logger').child({component: 'TraceContext'})
const hashes = require('../util/hashes')
const TRACE_CONTEXT_PARENT_HEADER = 'traceparent'
const TRACE_CONTEXT_STATE_HEADER = 'tracestate'
const parentTypes = ['App', 'Browser', 'Mobile']

const FLAGS = {
  sampled: 0x00000001
}

/**
 * The class reponsible for accpeting, producing, and validating w3c tracecontext headers.
 */
class TraceContext {
  /**
   * Create a TraceContext object
   * @param {Transaction} transaction - a transaction object to attach to.
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

  /**
   * Takes a headers object and modifies it in place by adding TraceContext headers
   * @param {object} headers - Headers for an HTTP request
   */
  addTraceContextHeaders(headers) {
    // This gets the transaction object to calculate priority and set the sampled property
    const traceContextHeaders = this.createTraceContextPayload()
    Object.assign(headers, traceContextHeaders)
  }

  /**
   * Takes a TraceContext headers from an HTTP request, parses them, validates them, and
   * applies the values to the internal state.
   *
   * @param {string} traceparent - W3C traceparent header from an HTTP request
   * @param {string} tracestate - W3C tracestate header from an HTTP request
   */
  acceptTraceContextPayload(traceparent, tracestate) {
    if (!traceparent)
      // From the W3C spec: If the vendor failed to parse traceparent, it MUST NOT
      // attempt to parse tracestate
      return

    logger.trace('Accepting TraceContext for transaction %s', this.transaction.id)

    const parsedParent = this._validateTraceParentHeader(traceparent)

    if (parsedParent) {
      logger.trace('Accepted traceparent for transaction %s', this.transaction.id)
      this.version = parsedParent.version
      this._traceId = parsedParent.traceId
      this._parentId = parsedParent.parentId
      // Ignore the sampled flag for now
      // this.flags = this.parseFlagsHex(parsed.flags)
    } else {
      logger.error('Invalid traceparent for transaction %s: %s',
        this.transaction.id, traceparent)
      // From the W3C spec: If the vendor failed to parse traceparent, it MUST NOT
      // attempt to parse tracestate
      return
    }

    if (!tracestate) {
      logger.trace('No tracestate for transaction %s', this.transaction.id)
      return
    }

    const parsedState = this._validateTraceStateHeader(tracestate)

    // Keep the raw, non-NewRelic trace state string stored so that we can propogate it
    this._traceStateRaw = parsedState.newTraceState

    if (parsedState && parsedState.entryValid) {
      logger.trace('Accepted tracestate for transaction %s', this.transaction.id)
      this._traceStateIntrinsics = parsedState.intrinsics
    } else {
      logger.error('Invalid tracestate for transaction %s: %s',
        this.transaction.id, tracestate)
    }
  }

  /**
   * Validate a traceparent header string and return an object with the relevant parts
   * parsed out if valid.
   *
   * @param {string} traceparent - a W3C traceparent header string
   * @returns {(boolean|Object)} returns false if invalid or an Object with the
   * traceparent data
   */
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

  /**
   * @typedef TraceStateValidation
   * @property {boolean} entryFound - Whether a New Relic tracestate string with a match
   * trusted account key field is found
   * @property {boolean} entryValid - Whether the matching NR tracestate string is valid
   * @property {Intrinsics} intrinsics - All the parts of the New Relic tracestate string
   * parsed and split out into an object
   * @property {string} newTraceState - The raw tracestate without the New Relic entry
   */

  /**
   * Accepts a W3C tracestate header string and returns an object with information about
   * the validity and intrinsics of the tracestate
   *
   * @param {string} tracestate - A raw W3C tracestate header string
   * @returns {TraceStateValidation} returns an object with validation information and
   * instrinsics on any relevant New Relic tracestate strings found
   */
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

  /**
   * @typedef Intrinsics
   * @property {number} version - TraceContext spec version used
   * @property {number} parentType - The type of component that produced this tracestate
   * @property {string} accountId
   * @property {string} appId
   * @property {string} spanId
   * @property {string} transactionId
   * @property {integer} sampled - 1 or 0, whether the receiving agent should sample
   * @property {number} priority - floating point of the priority the agent should use,
   * rounded to 6 decimal places
   * @property {number} timestamp - when the payload was created, milliseconds since epoch
   */
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
