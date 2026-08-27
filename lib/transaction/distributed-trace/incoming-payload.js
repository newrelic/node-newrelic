/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('#agentlib/logger.js').child({
  component: 'IncomingPayload'
})

const REQUIRED_DT_KEYS = ['ty', 'ac', 'ap', 'tr', 'ti']
const DT_ACCEPT_PAYLOAD_EXCEPTION_METRIC = 'DistributedTrace/AcceptPayload/Exception'
const DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC = 'DistributedTrace/AcceptPayload/ParseException'

class IncomingPayload {
  #agent
  #logger
  #transaction

  constructor({
    agent,
    transaction,
    logger = defaultLogger
  } = {}) {
    this.#agent = agent
    this.#logger = logger
    this.#transaction = transaction
  }

  parseAndApply(payload, transport) {
    if (!payload) {
      this.#agent.recordSupportability('DistributedTrace/AcceptPayload/Ignored/Null')
      return
    }
    if (this.#isDtAlreadyRecorded() === true) {
      return
    }

    const trustedAccount = this.#getTrustedAccount()
    if (trustedAccount === undefined) {
      return
    }

    const parsed = this.#parse(payload)
    if (this.#isValidParsedObject(parsed) === false) {
      this.#logger.trace(
        'Distributed trace payload for transaction %s is not a valid object, not accepting',
        this.#transaction.id
      )
      return
    }

    if (this.#getMajorVersion(parsed) > 0) {
      return
    }

    const data = parsed.d
    if (!data) {
      this.#logger.warn('No distributed trace data received, not accepting payload')
      this.#agent.recordSupportability(DT_ACCEPT_PAYLOAD_EXCEPTION_METRIC)
      return
    }

    if (
      this.#requiredKeysExist(data) === false ||
      this.#requiredParentSpanExists(data) === false
    ) {
      return
    }

    const trustedAccountKey = data.tk || data.ac
    if (trustedAccountKey !== trustedAccount) {
      this.#agent.recordSupportability('DistributedTrace/AcceptPayload/Ignored/UntrustedAccount')
      return
    }

    this.#transaction.parentType = data.ty
    this.#transaction.parentApp = data.ap
    this.#transaction.parentAcct = data.ac
    this.#transaction.parentTransportType = transport
    this.#transaction.parentTransportDuration = Math.max(
      0,
      (Date.now() - data.ti) / 1_000
    )
    this.#transaction.traceId = data.tr
    if (data.pr) {
      this.#transaction.priority = data.pr
      this.#transaction.sampled = data.sa != null ? data.sa : this.#transaction.sampled
      this.#agent.samplers.applyLegacyDTSamplingDecision({
        transaction: this.#transaction,
        isSampled: data?.sa
      })
    }
    if (data.tx) {
      this.#transaction.parentId = data.tx
    }
    if (data.id) {
      this.#transaction.parentSpanId = data.id
    }
    this.#transaction.isDistributedTrace = true
    this.#transaction.acceptedDistributedTrace = true

    this.#agent.recordSupportability('DistributedTrace/AcceptPayload/Success')
  }

  /**
   * Decodes (if base64) and JSON-parses a raw New Relic DT header value.
   *
   * @param {string} payload the raw `newrelic` header value
   * @returns {object|undefined} the parsed payload, or `undefined` when the
   * input is not a parseable string. Records the parse-exception supportability
   * metric when a string fails to parse.
   */
  #parse(payload) {
    if (typeof payload !== 'string') {
      this.#logger.trace(
        'Distributed trace payload for transaction %s is not a string, not accepting',
        this.#transaction.id
      )
      return undefined
    }

    const leadingChar = payload.charAt(0)
    if (leadingChar !== '{' && leadingChar !== '[') {
      payload = Buffer.from(payload, 'base64').toString('utf-8')
    }

    try {
      return JSON.parse(payload)
    } catch (error) {
      this.#logger.warn(
        { err: error },
        'Failed to parse distributed trace payload in transaction %s',
        this.#transaction.id
      )
      this.#agent.recordSupportability(DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC)
      return undefined
    }
  }

  #getTrustedAccount() {
    const config = this.#agent.config
    const distTraceEnabled = config.distributed_tracing.enabled
    const trustedAccount = config.trusted_account_key || config.account_id

    if (!distTraceEnabled || !trustedAccount) {
      this.#logger.debug(
        'Invalid configuration for distributed trace payload, not accepting ' +
        '(distributed_tracing.enabled: %s, trustKey: %s',
        distTraceEnabled,
        trustedAccount
      )
      this.#agent.recordSupportability(DT_ACCEPT_PAYLOAD_EXCEPTION_METRIC)

      return undefined
    }

    return trustedAccount
  }

  #isDtAlreadyRecorded() {
    if (this.#transaction.isDistributedTrace !== true) {
      return false
    }

    this.#logger.warn(
      'Already accepted or created a distributed trace payload for transaction %s, ignoring call',
      this.#transaction.id
    )
    const supportabilityMetric = this.#transaction.parentId != null
      ? 'DistributedTrace/AcceptPayload/Ignored/Multiple'
      : 'DistributedTrace/AcceptPayload/Ignored/CreateBeforeAccept'
    this.#agent.recordSupportability(supportabilityMetric)
    return true
  }

  #isValidParsedObject(parsed) {
    if (parsed == null) {
      return false
    }

    if (parsed.v == null) {
      this.#logger.warn(
        'Received a distributed trace payload with no version field: %s',
        this.#transaction.id
      )
    }
    if (parsed.d == null) {
      this.#logger.warn(
        'Received a distributed trace payload with no data field: %s',
        this.#transaction.id
      )
    }
    if (parsed.v == null || parsed.d == null) {
      this.#agent.recordSupportability(DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC)
      return false
    }

    return true
  }

  #getMajorVersion(parsed) {
    const majorVersion = parsed.v && typeof parsed.v[0] === 'number' && parsed.v[0]

    if (majorVersion === null) {
      this.#logger.warn('Invalid distributed trace payload, not accepting')
      this.#agent.recordSupportability(DT_ACCEPT_PAYLOAD_EXCEPTION_METRIC)
    }
    if (majorVersion > 0) {
      // TODO: Add DistributedTracePayload class?
      this.#agent.recordSupportability('DistributedTrace/AcceptPayload/Ignored/MajorVersion')
    }
    return majorVersion
  }

  #requiredKeysExist(data) {
    for (const key of REQUIRED_DT_KEYS) {
      if (data[key] == null) {
        this.#agent.recordSupportability(DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC)
        return false
      }
    }
    return true
  }

  #requiredParentSpanExists(data) {
    if (data.tx == null && data.id == null) {
      this.#agent.recordSupportability(DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC)
      return false
    }
    return true
  }
}

module.exports = IncomingPayload
