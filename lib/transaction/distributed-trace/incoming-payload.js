/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('#agentlib/logger.js').child({
  component: 'IncomingPayload'
})
const { Payload } = require('./payload.js')

const DT_ACCEPT_PAYLOAD_EXCEPTION_METRIC = 'DistributedTrace/AcceptPayload/Exception'
const DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC = 'DistributedTrace/AcceptPayload/ParseException'

/**
 * Interface for parsing a New Relic distributed trace header and applying
 * the discovered data to the current transaction. First, construct the
 * instance to attach the current agent and transaction to it. Second,
 * use the {@link #parseAndApply} method to parse the header and apply the
 * data to the transaction.
 */
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

  /**
   * Verifies the payload is a valid New Relic distributed trace payload.
   * Upon successful validation and parsing, updates the current transaction
   * with the payload data.
   *
   * @param {string} payload The value from the incoming request header. May
   * be a JSON string or a base64 encoded representation of one.
   * @param {string} transport The validated transport type string. Validation
   * should happen when the request is received.
   */
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

    let parsed
    try {
      parsed = new Payload({ input: payload, agent: this.#agent })
    } catch (error) {
      this.#logger.warn(
        { err: error },
        'Distributed trace payload for transaction %s is not a valid object, not accepting',
        this.#transaction.id
      )
      this.#agent.recordSupportability(DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC)
      return
    }

    if (parsed.major > 0) {
      this.#agent.recordSupportability('DistributedTrace/AcceptPayload/Ignored/MajorVersion')
      return
    }

    const data = parsed.data
    if (this.#requiredParentSpanExists(data) === false) {
      return
    }

    const trustedAccountKey = data.trustKey || data.accountId
    if (trustedAccountKey !== trustedAccount) {
      this.#agent.recordSupportability('DistributedTrace/AcceptPayload/Ignored/UntrustedAccount')
      return
    }

    this.#transaction.parentType = data.type
    this.#transaction.parentApp = data.appId
    this.#transaction.parentAcct = data.accountId
    this.#transaction.parentTransportType = transport
    this.#transaction.parentTransportDuration = Math.max(
      0,
      (Date.now() - data.timestamp) / 1_000
    )
    this.#transaction.traceId = data.traceId
    if (data.priority) {
      this.#transaction.priority = data.priority
      this.#transaction.sampled = data.sampled != null
        ? data.sampled
        : this.#transaction.sampled
      this.#agent.samplers.applyLegacyDTSamplingDecision({
        transaction: this.#transaction,
        isSampled: data.sampled
      })
    }
    if (data.transactionId) {
      this.#transaction.parentId = data.transactionId
    }
    if (data.guid) {
      this.#transaction.parentSpanId = data.guid
    }
    this.#transaction.isDistributedTrace = true
    this.#transaction.acceptedDistributedTrace = true

    this.#agent.recordSupportability('DistributedTrace/AcceptPayload/Success')
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

  #requiredParentSpanExists(data) {
    if (data.transactionId == null && data.guid == null) {
      this.#agent.recordSupportability(DT_ACCEPT_PAYLOAD_PARSE_EXCEPTION_METRIC)
      return false
    }
    return true
  }
}

module.exports = IncomingPayload
