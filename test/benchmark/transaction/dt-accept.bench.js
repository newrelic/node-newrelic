/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('#testlib/agent_helper.js')
const benchmark = require('#testlib/benchmark.js')
const Transaction = require('#agentlib/transaction/index.js')

// Configure the mocked agent so the DT accept path actually executes instead of
// bailing early in `_dtConfigTest` (requires distributed_tracing.enabled and a
// trusted account key) or `_dtSpanParentTest`/trusted-account checks.
const agent = helper.loadMockedAgent()
agent.config.distributed_tracing.enabled = true
agent.config.account_id = '1'
agent.config.trusted_account_key = '1'
agent.config.primary_application_id = 'test-app'

const suite = benchmark.createBenchmark({
  name: 'transaction DT accept'
})

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

// The accept path is single-shot per transaction: `_isDtTest` short-circuits
// once `isDistributedTrace` is set, and it mutates parent* fields. So every
// measured run needs a fresh transaction. Build it in `before` (excluded from
// the measured work) and hand it to `fn` as the context object.

suite.add({
  name: '_acceptDistributedTracePayload (object payload)',
  before: function makeTxn() {
    return { txn: new Transaction(agent), payload: makePayload() }
  },
  fn: function (_agent, { txn, payload }) {
    // Exercises the full `.bind(this)`-per-call helper chain:
    // _dtPayloadTest -> _isDtTest -> _dtConfigTest -> _dtParseTest ->
    // _dtVersionTest -> _dtRequiredKeyTest -> _dtSpanParentTest ->
    // _dtDefineAttrsFromTraceData
    return txn._acceptDistributedTracePayload(payload, 'HTTP')
  }
})

suite.add({
  name: '_acceptDistributedTracePayload (base64 string payload)',
  before: function makeTxn() {
    // A stringified, base64-encoded payload additionally exercises
    // `_getParsedPayload` (Buffer.from + JSON.parse) on the hot path.
    const encoded = Buffer.from(JSON.stringify(makePayload())).toString('base64')
    return { txn: new Transaction(agent), payload: encoded }
  },
  fn: function (_agent, { txn, payload }) {
    return txn._acceptDistributedTracePayload(payload, 'HTTP')
  }
})

suite.add({
  name: 'acceptDistributedTraceHeaders (newrelic header)',
  before: function makeTxn() {
    const encoded = Buffer.from(JSON.stringify(makePayload())).toString('base64')
    return { txn: new Transaction(agent), headers: { newrelic: encoded } }
  },
  fn: function (_agent, { txn, headers }) {
    // Public entry point: header dispatch + the accept chain above.
    return txn.acceptDistributedTraceHeaders('HTTP', headers)
  }
})

suite.add({
  name: '_getParsedPayload (base64 decode + JSON.parse)',
  before: function makeTxn() {
    const encoded = Buffer.from(JSON.stringify(makePayload())).toString('base64')
    return { txn: new Transaction(agent), payload: encoded }
  },
  fn: function (_agent, { txn, payload }) {
    return txn._getParsedPayload(payload)
  }
})

suite.run()
