/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const OutgoingPayload = require('#agentlib/transaction/distributed-trace/outgoing-payload.js')
const IncomingPayload = require('#agentlib/transaction/distributed-trace/incoming-payload.js')

/**
 * Performs a distributed-trace round-trip against a transaction: it builds an
 * outbound New Relic DT payload representing the transaction, clears the
 * `isDistributedTrace` guard, and accepts the payload back onto the same
 * transaction. This leaves the transaction in the state it would be in after
 * accepting an inbound DT header, a common precondition for tests.
 *
 * @param {Agent} agent The agent bound to the transaction.
 * @param {Transaction} transaction The transaction to build from and apply to.
 * @param {string} [transport] The transport type that delivered the payload.
 * Only pass when the test asserts on the transport.
 */
function createDistributedTracePayload(agent, transaction, transport) {
  const config = agent.config
  const data = {
    ty: 'App',
    ac: config.account_id,
    ap: config.primary_application_id,
    tx: transaction.id,
    tr: transaction.traceId,
    pr: transaction.priority,
    sa: transaction.sampled,
    ti: Date.now()
  }
  if (config.trusted_account_key && config.trusted_account_key !== config.account_id) {
    data.tk = config.trusted_account_key
  }

  const payload = new OutgoingPayload(data).text()

  transaction.isDistributedTrace = null
  new IncomingPayload({ agent, transaction }).parseAndApply(payload, transport)
}

module.exports = createDistributedTracePayload
