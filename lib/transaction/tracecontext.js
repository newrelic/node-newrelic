/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../logger').child({ component: 'TraceContext' })
const hashes = require('../util/hashes')

const TRACE_CONTEXT_PARENT_HEADER = 'traceparent'
const TRACE_CONTEXT_STATE_HEADER = 'tracestate'
const PARENT_TYPES = ['App', 'Browser', 'Mobile']
const APP_PARENT_TYPE = PARENT_TYPES.indexOf('App')

const W3C_TRACEPARENT_VERSION = '00'
const NR_TRACESTATE_VERSION = 0

// 255 (ff) explicitly not allowed for version
const VERSION_VALID_RGX = /^((?![f]{2})[a-f0-9]{2})$/
const TRACEID_VALID_RGX = /^((?![0]{32})[a-f0-9]{32})$/
const PARENTID_VALID_RGX = /^((?![0]{16})[a-f0-9]{16})$/
const FLAGS_VALID_RGX = /^([a-f0-9]{2})$/

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
   * @returns {string} a W3C TraceContext traceparent header payload.
   */
  createTraceparent() {
    // In case we receive a trace ID that isn't the proper length, zero pad
    let traceId = this.transaction.traceId
    traceId = traceId.padStart(32, '0')

    // If we had to pad, there's a chance this is an invalid upper-case header
    // originating from a newrelic format DT payload being accepted.
    if (traceId !== this.transaction.traceId && !TRACEID_VALID_RGX.test(traceId)) {
      traceId = traceId.toLowerCase()
    }

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

    return `${W3C_TRACEPARENT_VERSION}-${traceId}-${parentId}-${this.createFlagsHex()}`
  }

  /**
   * Creates a W3C TraceContext tracestate header payload.
   *
   * @returns {string} tracestate, a hyphen-delimited string of trace information fields
   */
  createTracestate() {
    const config = this.transaction.agent.config
    const trustedAccountKey = config.trusted_account_key
    const version = NR_TRACESTATE_VERSION
    const parentType = APP_PARENT_TYPE
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
      const segment = this.transaction.agent.tracer.getSegment()
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
   */
  addTraceContextHeaders(headers) {
    if (!headers) {
      return
    }

    const traceParent = this.createTraceparent()
    headers[TRACE_CONTEXT_PARENT_HEADER] = traceParent

    logger.trace('traceparent added with %s', traceParent)

    const tracestate = this.createTracestate()
    if (tracestate) {
      headers[TRACE_CONTEXT_STATE_HEADER] = tracestate
      logger.trace('tracestate added with %s', tracestate)
    }

    this.transaction.agent.recordSupportability('TraceContext/Create/Success')
  }

  /**
   * @typedef TraceContextData
   * @property {boolean} acceptedTraceparent - Whether a W3C traceparent headers was
   * parsed, validated, and accepted
   * @property {boolean} acceptedTracestate - Whether a New Relic tracestate headers was
   * parsed, validated, and accepted
   * @property {boolean} entryValid - Whether the matching NR tracestate string is valid
   * @property {Intrinsics} intrinsics - All the parts of the New Relic tracestate string
   * parsed and split out into an object
   * @property {string} newTraceState - The raw tracestate without the New Relic entry
   */

  /**
   * Takes a TraceContext headers from an HTTP request, parses them, validates them, and
   * applies the values to the internal state, returning an object with the
   * relevant Trace Context data and validation information.
   *
   * @param {string} traceparent - W3C traceparent header from an HTTP request
   * @param {string} tracestate - W3C tracestate header from an HTTP request
   * @returns {object} returns an Object with the traceparent data and validation info
   */
  acceptTraceContextPayload(traceparent, tracestate) {
    const traceContextData = {
      acceptedTraceparent: false,
      acceptedTracestate: false,
      acceptedNRTracestate: false,
      traceId: null,
      parentSpanId: null,
      parentType: null,
      accountId: null,
      appId: null,
      transactionId: null,
      sampled: null,
      priority: null,
      transportDuration: null
    }

    //
    // Parsing traceparent
    //
    if (!traceparent) {
      // From the W3C spec: If the vendor failed to parse traceparent, it MUST NOT
      // attempt to parse tracestate
      return traceContextData
    }

    logger.trace('Accepting TraceContext for transaction %s', this.transaction.id)
    const parsedParent = this._validateAndParseTraceParentHeader(traceparent)

    // Log if there is a version mismatch in traceparent
    if (parsedParent.version !== W3C_TRACEPARENT_VERSION) {
      logger.trace(
        'Incoming traceparent version: %s, agent traceparent version: %s',
        parsedParent.version,
        W3C_TRACEPARENT_VERSION
      )
    }

    if (parsedParent.entryValid) {
      logger.trace('Accepted traceparent for transaction %s', this.transaction.id)
      traceContextData.acceptedTraceparent = true

      traceContextData.traceId = parsedParent.traceId
      traceContextData.parentSpanId = parsedParent.parentId
    } else {
      logger.trace('Invalid traceparent for transaction %s: %s', this.transaction.id, traceparent)

      this.transaction.agent.recordSupportability('TraceContext/TraceParent/Parse/Exception')
      // From the W3C spec: If the vendor failed to parse traceparent, it MUST NOT
      // attempt to parse tracestate
      return traceContextData
    }

    //
    // Parsing tracestate
    //
    if (!tracestate) {
      logger.trace('No tracestate for transaction %s', this.transaction.id)

      return traceContextData
    }

    const parsedState = this._validateAndParseTraceStateHeader(tracestate)

    if (!parsedState.traceStateValid) {
      logger.trace('Invalid tracestate for transaction %s: %s', this.transaction.id, tracestate)

      this.transaction.agent.recordSupportability('TraceContext/TraceState/Parse/Exception')
      return traceContextData
    }

    // Keep the raw, non-NewRelic tracestate string stored so that we can propagate it
    this._traceStateRaw = parsedState.newTraceState

    // These need to be kept to be added to root span events as an attribute
    this.tracingVendors = parsedState.vendors

    if (parsedState.intrinsics && parsedState.intrinsics.version !== NR_TRACESTATE_VERSION) {
      logger.trace(
        'Incoming tracestate version: %s, agent tracestate version: %s',
        parsedState.intrinsics.version,
        NR_TRACESTATE_VERSION
      )
    }

    if (parsedState.entryValid) {
      logger.trace('Accepted tracestate for transaction %s', this.transaction.id)
      traceContextData.acceptedTracestate = true

      traceContextData.parentType = parsedState.intrinsics.parentType
      traceContextData.accountId = parsedState.intrinsics.accountId
      traceContextData.appId = parsedState.intrinsics.appId
      traceContextData.transactionId = parsedState.intrinsics.transactionId
      traceContextData.sampled = parsedState.intrinsics.sampled
      traceContextData.priority = parsedState.intrinsics.priority
      traceContextData.transportDuration = Math.max(
        0,
        (Date.now() - parsedState.intrinsics.timestamp) / 1000
      )

      this.trustedParentId = parsedState.intrinsics.spanId
      this._traceStateRaw = parsedState.newTraceState

      this.transaction.agent.recordSupportability('TraceContext/Accept/Success')
    } else if (parsedState.entryFound) {
      logger.error('Invalid tracestate for transaction %s: %s', this.transaction.id, tracestate)

      this.transaction.agent.recordSupportability('TraceContext/TraceState/InvalidNrEntry')
    }

    return traceContextData
  }

  /**
   * Validate a traceparent header string and return an object with the relevant parts
   * parsed out if valid.
   *
   * @param {string} traceparent - a W3C traceparent header string
   * @returns {object} returns an Object with the traceparent data and validation info
   */
  _validateAndParseTraceParentHeader(traceparent) {
    const traceParentInfo = {
      entryValid: false,
      version: null,
      traceId: null,
      parentId: null,
      flags: null
    }

    if (!traceparent) {
      return traceParentInfo
    }

    const trimmed = traceparent.trim()
    const parts = trimmed.split('-')

    // No extra data allowed this version.
    if (parts[0] === W3C_TRACEPARENT_VERSION && parts.length !== 4) {
      return traceParentInfo
    }

    const [version, traceId, parentId, flags] = parts
    const isValid =
      VERSION_VALID_RGX.test(version) &&
      TRACEID_VALID_RGX.test(traceId) &&
      PARENTID_VALID_RGX.test(parentId) &&
      FLAGS_VALID_RGX.test(flags)

    if (isValid) {
      traceParentInfo.entryValid = true
      traceParentInfo.version = version
      traceParentInfo.traceId = traceId
      traceParentInfo.parentId = parentId
      traceParentInfo.flags = flags
    }

    return traceParentInfo
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

  /**
   * @typedef TraceStateData
   * @property {boolean} entryFound - Whether a New Relic tracestate string with a match
   * trusted account key field is found
   * @property {boolean} entryValid - Whether the matching NR tracestate string is valid
   * @property {string} entryInvalidReason - Why the tracestate did not validate
   * @property {Intrinsics} intrinsics - All the parts of the New Relic tracestate string
   * parsed and split out into an object
   * @property {string} newTraceState - The raw tracestate without the New Relic entry
   * @property {Array} vendors - All the vendor strings found in the tracestate
   */

  /**
   * Accepts a W3C tracestate header string and returns an object with information about
   * the validity and intrinsics of the parsed tracestate string
   *
   * @param {string} tracestate - A raw W3C tracestate header string
   * @returns {TraceStateData} returns an object with validation information and
   * instrinsics on any relevant New Relic tracestate strings found
   */
  _validateAndParseTraceStateHeader(tracestate) {
    const tsd = {
      entryFound: false,
      entryValid: undefined,
      entryInvalidReason: undefined,
      traceStateValid: undefined,
      intrinsics: undefined,
      newTraceState: undefined,
      vendors: undefined
    }

    // See if there's a New Relic Trace State
    const trustedKey = this.transaction.agent.config.trusted_account_key
    const hasTrustKey = Boolean(trustedKey)
    const expectedNrKey = `${trustedKey}@nr`

    if (!hasTrustKey) {
      logger.debug(
        'Unable to accept any New Relic tracestate list members. ' +
          'Missing trusted_account_key. ' +
          'This may occur if a trace is received prior to the agent fully starting.'
      )

      this.transaction.agent.recordSupportability('TraceContext/TraceState/Accept/Exception')
    }

    const { finalListMembers, vendors, nrTraceStateValue, traceStateValid } = this._parseTraceState(
      { tracestate, hasTrustKey, expectedNrKey }
    )

    tsd.traceStateValid = traceStateValid

    if (!traceStateValid) {
      return tsd
    }

    // Rebuild potentially cleaned-up listmembers
    tsd.newTraceState = finalListMembers.join(',')

    if (vendors.length > 0) {
      tsd.vendors = vendors.join(',')
    }

    if (!hasTrustKey) {
      return tsd
    }

    if (nrTraceStateValue) {
      tsd.entryFound = true

      const intrinsicsValidation = this._validateAndParseIntrinsics(nrTraceStateValue)
      if (intrinsicsValidation.entryValid) {
        tsd.entryValid = true
        tsd.intrinsics = intrinsicsValidation
      } else {
        tsd.entryInvalidReason = intrinsicsValidation.invalidReason
        tsd.entryValid = false
      }
    } else {
      // TraceParent has been accepted, but no trustedKey on tracestate
      this.transaction.agent.recordSupportability('TraceContext/TraceState/NoNrEntry')
    }

    return tsd
  }

  _parseTraceState(params) {
    const { tracestate, hasTrustKey, expectedNrKey } = params
    let nrTraceStateValue = null
    const finalListMembers = []
    const vendors = []
    const incomingListMembers = tracestate.split(',')
    for (let i = 0; i < incomingListMembers.length; i++) {
      const listMember = incomingListMembers[i].trim()

      // Multiple tracestate headers may get combined. Empty headers
      // can result in a header such as tracestate: 'foo=1, ' which
      // should still be considered valid with the empty item discarded.
      if (listMember !== '') {
        const listMemberParts = listMember.split('=')
        if (listMemberParts.length !== 2) {
          logger.debug('Unable to parse tracestate list members.')
          this.transaction.agent.recordSupportability(
            'TraceContext/TraceState/Parse/Exception/ListMember'
          )

          return { traceStateValid: false }
        }

        const [vendorKey, vendorValue] = listMemberParts
        if (hasTrustKey && vendorKey === expectedNrKey) {
          // Matching members do not get added to vendors.
          // We'll replace the first valid entry and drop the rest
          // (which would be invalid members if they exist).

          // We only want the first one.
          nrTraceStateValue = nrTraceStateValue || vendorValue
        } else {
          vendors.push(vendorKey)

          finalListMembers.push(listMember)
        }
      }
    }
    return { finalListMembers, vendors, nrTraceStateValue, traceStateValid: true }
  }

  /**
   * @typedef Intrinsics
   * @property {number} version - TraceContext spec version used
   * @property {number} parentType - The type of component that produced this tracestate
   * @property {string} accountId New Relic account ID
   * @property {string} appId ID of  the application generating the trace header
   * @property {string} spanId unique identifier for the span
   * @property {string} transactionId unique identifier for the transaction
   * @property {number} sampled - 1 or 0, whether the receiving agent should sample
   * @property {number} priority - floating point of the priority the agent should use,
   * rounded to 6 decimal places
   * @property {number} timestamp - when the payload was created, milliseconds since epoch
   * @property {boolean} entryValid - if all entries in the Intrinsics object is valid
   */

  /**
   * Accepts a New Relic intrinsics string and returls a validation object w/
   * the validity and intrinsics of the tracestate
   *
   * @param {string} nrTracestateValue - The value part of a New Relic tracestate entry
   * @returns {Intrinsics} returns an Intrinsics object with validation information and
   * instrinsics on any relevant New Relic tracestate strings found
   */
  _validateAndParseIntrinsics(nrTracestateValue) {
    const intrinsics = this._parseIntrinsics(nrTracestateValue)

    // Functions that return true when the field is invalid
    const isNull = (v) => v == null
    const intrinsicInvalidations = {
      version: isNaN, // required, int
      parentType: isNull, // required, str
      accountId: isNull, // required, str
      appId: isNull, // required, str
      sampled: (v) => (v == null ? false : isNaN(v)), // not required, int
      priority: (v) => (v == null ? false : isNaN(v)), // not required, float
      timestamp: isNaN // required, int
    }

    // If a field is found invalid, flag the entry as not valid
    intrinsics.entryValid = true
    for (const key of Object.keys(intrinsicInvalidations)) {
      const invalidation = intrinsicInvalidations[key]
      if (invalidation && invalidation(intrinsics[key])) {
        intrinsics.entryValid = false
        intrinsics.entryInvalidReason = `${key} failed invalidation test`
      }
    }

    // Convert to types expected by Transaction
    if (intrinsics.sampled != null) {
      intrinsics.sampled = Boolean(intrinsics.sampled)
    }

    intrinsics.parentType = PARENT_TYPES[intrinsics.parentType]
    if (!intrinsics.parentType) {
      intrinsics.entryValid = false
    }

    return intrinsics
  }

  /**
   * Parses intrinsics of a New Relic tracestate entry's value
   *
   * @param {object} nrTracestateValue An object consisting of split value intrinsics derived from
   * the trace state, having the form { version, parentType, accountId, appId, spanId,
   * transactionId, sampled, priority, timestamp }
   * @returns {object} Intrinsics: trace state information extracted from trace state value
   */
  _parseIntrinsics(nrTracestateValue) {
    const intrinsics = this._extractTraceStateIntrinsics(nrTracestateValue)

    const intrinsicConversions = {
      version: parseInt,
      parentType: parseInt,

      // these two can be null, don't try to parse a null
      sampled: (v) => (v == null ? v : parseInt(v, 10)),
      priority: (v) => (v == null ? v : parseFloat(v)),

      timestamp: parseInt
    }

    for (const key of Object.keys(intrinsicConversions)) {
      const conversion = intrinsicConversions[key]
      if (conversion) {
        intrinsics[key] = conversion(intrinsics[key])
      }
    }

    return intrinsics
  }

  _extractTraceStateIntrinsics(nrTracestate) {
    const splitValues = nrTracestate.split('-')

    // convert empty strings to null
    splitValues.forEach((value, i) => {
      if (value === '') {
        splitValues[i] = null
      }
    })

    return {
      version: splitValues[0],
      parentType: splitValues[1],
      accountId: splitValues[2],
      appId: splitValues[3],
      spanId: splitValues[4],
      transactionId: splitValues[5],
      sampled: splitValues[6],
      priority: splitValues[7],
      timestamp: splitValues[8]
    }
  }
}

module.exports.TraceContext = TraceContext
module.exports.TRACE_CONTEXT_PARENT_HEADER = TRACE_CONTEXT_PARENT_HEADER
module.exports.TRACE_CONTEXT_STATE_HEADER = TRACE_CONTEXT_STATE_HEADER
