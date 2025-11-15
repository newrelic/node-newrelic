/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('../logger').child({ component: 'tracestate' })
const TracestateIntrinsics = require('./tracestate-intrinsics')

/**
 * Parses a W3C traceparent header into an object representation.
 *
 * @see {@link https://www.w3.org/TR/trace-context/#tracestate-header}
 *
 * @property {string[]|null} vendors A set of vendor key names found in the
 * header.
 * @property {string[]} listMembers The set of reduced list member (key value
 * pairs) found in the header.
 * @property {string|null} nrTraceStateValue The first New Relic trace state
 * value found in the list members list.
 * @property {string} nrTrustKey Configured trust key from the agent.
 * @property {TracestateIntrinsics|undefined} intrinsics When a New Relic
 * trace state is present, it will be parsed into intrinsics and stored here.
 */
class Tracestate {
  #agent
  #logger

  /**
   * Version number for New Relic formatted tracestate encodings.
   *
   * @type {number}
   */
  static NR_TRACESTATE_VERSION = 0

  /**
   * @param {object} params Parameters for construction.
   * @param {Agent} params.agent A New Relic agent instance.
   * @param {string[]} params.kvPairs The list of list members to parse, e.g.
   * `['a=b', 'c=d']`.
   * @param {object} [params.logger] A logger instance.
   *
   * @throws {Error} If the provided agent is not a valid instance or any
   * list member is in an invalid format.
   */
  constructor({ agent, kvPairs = [], logger = defaultLogger }) {
    if (Object.prototype.toString.call(agent) !== '[object Agent]') {
      throw Error('agent must be an agent instance')
    }

    this.#agent = agent
    this.#logger = logger

    const trustedKey = this.#agent.config.trusted_account_key
    const hasTrustKey = Boolean(trustedKey)
    const expectedNrKey = `${trustedKey}@nr`

    if (hasTrustKey === false) {
      logger.debug(
        'Unable to accept any New Relic tracestate list members. ' +
        'Missing trusted_account_key. ' +
        'This may occur if a trace is received prior to the agent fully starting.'
      )
      this.#agent.recordSupportability('TraceContext/TraceState/Accept/Exception')
    }

    let nrTraceStateValue = null
    const vendors = new Set()
    const listMembers = new Map()
    for (const listMember of kvPairs) {
      const parts = listMember.split('=', 2).filter((v) => Boolean(v))
      if (parts.length !== 2) {
        this.#logger.debug('Unable to parse tracestate list members.')
        this.#agent.recordSupportability('TraceContext/TraceState/Parse/Exception/ListMember')
        throw Error(`list member is not in parseable format: ${listMember}`)
      }

      const [vendorKey, vendorValue] = parts
      if (hasTrustKey === true && vendorKey === expectedNrKey) {
        // We do not add New Relic states to the vendors list. It's not clear
        // _why_, but the original tracestate implementation made this decision
        // so we are propagating it. ~ James Sumners 2025-03-21

        // We only want the first found New Relic value. Any subsequent entries
        // are to be considered invalid.
        nrTraceStateValue = nrTraceStateValue ?? vendorValue
      } else {
        vendors.add(vendorKey)
        listMembers.set(vendorKey, vendorValue)
      }
    }

    let intrinsics
    if (nrTraceStateValue) {
      intrinsics = new TracestateIntrinsics()
      const values = nrTraceStateValue.split('-').map((v) => (v === '' ? null : v))
      intrinsics.version = values[0]
      intrinsics.parentType = values[1]
      intrinsics.accountId = values[2]
      intrinsics.appId = values[3]
      intrinsics.spanId = values[4]
      intrinsics.transactionId = values[5]
      intrinsics.sampled = values[6]
      intrinsics.priority = values[7]
      intrinsics.timestamp = values[8]
    } else {
      this.#agent.recordSupportability('TraceContext/TraceState/NoNrEntry')
    }

    Object.defineProperties(this, {
      vendors: {
        enumerable: true,
        // Ideally, we'd set it to an empty array if there are not any vendors
        // in the list. But we have test code, particularly in the cross agents
        // test suite, that looks for a `null` value in that case. Instead of
        // trying to trace down all of those possible locations, we propagate
        // the original design. ~ James Sumners 2025-03-21
        value: vendors.size > 0 ? Array.from(vendors) : null
      },
      listMembers: {
        enumerable: true,
        value: Array.from(listMembers.entries()).map(([k, v]) => `${k}=${v}`)
      },
      nrTraceStateValue: {
        enumerable: true,
        value: nrTraceStateValue
      },
      nrTrustKey: {
        enumerable: true,
        value: trustedKey
      },
      intrinsics: {
        enumerable: true,
        value: intrinsics
      }
    })
  }

  get [Symbol.toStringTag]() {
    return 'Tracestate'
  }

  static fromHeader({ header, agent, logger = defaultLogger }) {
    if (!header) {
      // There is some case where the header comes in as `undefined`. In that
      // case, we want an empty tracestate so that errors are not generated.
      return new Tracestate({ agent, logger, kvPairs: [] })
    }
    if (typeof header !== 'string') {
      throw Error('header value must be a string')
    }
    const kvPairs = header.split(',').map((item) => item.trim()).filter(Boolean)
    return new Tracestate({ agent, logger, kvPairs })
  }

  toString() {
    return this.listMembers.join(',')
  }

  /**
   * When a New Relic list member is present, returns whether or not the
   * trace was sampled upstream.
   *
   * @returns {boolean}
   */
  get isSampled() {
    return this.sampled
  }

  /**
   * New Relic account identifier when a New Relic listmember has been provided.
   *
   * @returns {string}
   */
  get parentAccountId() {
    return this.parent_account_id
  }

  /**
   * Application identifier as provided in a New Relic listmember.
   *
   * @returns {string}
   */
  get parentAppId() {
    return this.parent_application_id
  }

  /**
   * The type of application that generated the tracestate.
   *
   * @see {TracestateIntrinsics.PARENT_TYPES}
   * @returns {string}
   */
  get parentType() {
    return this.parent_type
  }

  /**
   * Priority value assigned to the trace upstream.
   *
   * @returns {number}
   */
  get priority() {
    return this.intrinsics?.priority
  }

  /**
   * Span identifier for the span that generated the trace upstream.
   *
   * @returns {string}
   */
  get spanId() {
    return this.span_id
  }

  /**
   * Milliseconds since epoch representing when the trace was generated upstream.
   *
   * @returns {number}
   */
  get timestamp() {
    return this.intrinsics?.timestamp
  }

  /**
   * The transaction identifier for the trace from the upstream system.
   *
   * @returns {string}
   */
  get transactionId() {
    return this.transaction_id
  }

  // begin: accessors for cross agent tests
  get sampled() {
    return Boolean(this.intrinsics?.sampled)
  }

  get parent_account_id() {
    return this.intrinsics?.accountId
  }

  get parent_application_id() {
    return this.intrinsics?.appId
  }

  get parent_type() {
    return this.intrinsics?.parentType
  }

  get span_id() {
    return this.intrinsics?.spanId
  }

  get tenant_id() {
    return this.nrTrustKey
  }

  get transaction_id() {
    return this.intrinsics?.transactionId
  }

  get version() {
    return this.intrinsics?.version
  }
  // end: accessors for cross agent tests
}

module.exports = Tracestate
