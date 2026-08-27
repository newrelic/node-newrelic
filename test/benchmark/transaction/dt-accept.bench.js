/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('#testlib/agent_helper.js')
const benchmark = require('#testlib/benchmark.js')
const Transaction = require('#agentlib/transaction/index.js')
const IncomingPayload = require('#agentlib/transaction/distributed-trace/incoming-payload.js')
const Transport = require('#agentlib/transaction/distributed-trace/transport.js')

// Configure the mocked agent so the DT accept path actually executes instead of
// bailing early in IncomingPayload#parseAndApply (requires
// distributed_tracing.enabled and a trusted account key that matches the
// payload's account).
const agent = helper.loadMockedAgent()
agent.config.distributed_tracing.enabled = true
agent.config.account_id = '1'
agent.config.trusted_account_key = '1'
agent.config.primary_application_id = 'test-app'

const suite = benchmark.createBenchmark({
  name: 'transaction DT accept'
})

// A single DT accept is sub-microsecond, well below what a per-sample
// process.cpuUsage() delta can resolve — measuring one call per sample is pure
// noise. Instead each measured `fn` runs ITERATIONS accepts so the per-sample
// work rises far above the timer floor and run-to-run variance collapses.
const ITERATIONS = 10000

// A valid v0 newrelic-format payload object. `tk`/`ac` must match the trusted
// account key above so it isn't rejected as an untrusted account.
function makePayload() {
  return {
    v: [0, 1],
    d: {
      ty: 'App',
      ac: '1',
      ap: 'test-app',
      tx: 'abc123',
      tr: 'trace-abc123',
      id: 'span-abc123',
      ti: Date.now() - 1
    }
  }
}

// The accept path is single-shot per transaction: IncomingPayload
// short-circuits once `isDistributedTrace` is set, and it mutates parent*
// fields. So each of the ITERATIONS accepts needs its own fresh transaction.
// Build the whole batch in `before` (excluded from the measured work) and have
// `fn` loop over it, so the measurement captures only the accept path — not
// Transaction construction or payload encoding.
//
// The accept path is driven by `new IncomingPayload({...}).parseAndApply(...)`,
// which takes a raw newrelic header string (plain JSON or base64), not an
// already-parsed object.

/**
 * Applies a DT payload to a transaction the way `acceptDistributedTraceHeaders`
 * does internally.
 *
 * @param {Transaction} transaction The transaction to apply the payload to.
 * @param {string} payload The raw newrelic header value.
 */
function acceptPayload(transaction, payload) {
  new IncomingPayload({ agent, transaction }).parseAndApply(payload, Transport.HTTP)
}

/**
 * Builds a batch of fresh transactions for one measured run.
 *
 * @returns {Transaction[]} ITERATIONS transactions, none yet distributed.
 */
function makeTransactions() {
  const txns = new Array(ITERATIONS)
  for (let i = 0; i < ITERATIONS; i++) {
    txns[i] = new Transaction(agent)
  }
  return txns
}

suite.add({
  name: 'IncomingPayload#parseAndApply (json string payload)',
  before: function build() {
    // Plain JSON string: parseAndApply skips base64 decode and goes straight
    // to JSON.parse + the parse/validate/apply chain.
    return { txns: makeTransactions(), payload: JSON.stringify(makePayload()) }
  },
  fn: function (_agent, { txns, payload }) {
    for (let i = 0; i < ITERATIONS; i++) {
      acceptPayload(txns[i], payload)
    }
  }
})

suite.add({
  name: 'IncomingPayload#parseAndApply (base64 string payload)',
  before: function build() {
    // A base64-encoded payload additionally exercises the Buffer.from decode
    // step in parseAndApply before JSON.parse.
    const encoded = Buffer.from(JSON.stringify(makePayload())).toString('base64')
    return { txns: makeTransactions(), payload: encoded }
  },
  fn: function (_agent, { txns, payload }) {
    for (let i = 0; i < ITERATIONS; i++) {
      acceptPayload(txns[i], payload)
    }
  }
})

suite.add({
  name: 'acceptDistributedTraceHeaders (newrelic header)',
  before: function build() {
    const encoded = Buffer.from(JSON.stringify(makePayload())).toString('base64')
    return { txns: makeTransactions(), headers: { newrelic: encoded } }
  },
  fn: function (_agent, { txns, headers }) {
    // Public entry point: header dispatch + the accept chain above.
    for (let i = 0; i < ITERATIONS; i++) {
      txns[i].acceptDistributedTraceHeaders(Transport.HTTP, headers)
    }
  }
})

suite.run()
