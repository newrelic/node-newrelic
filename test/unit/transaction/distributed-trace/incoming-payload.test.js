/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const sinon = require('sinon')
const helper = require('#testlib/agent_helper.js')
const Transaction = require('#agentlib/transaction/index.js')
const IncomingPayload = require('#agentlib/transaction/distributed-trace/incoming-payload.js')
const { Payload } = require('#agentlib/transaction/distributed-trace/payload.js')
const logger = require('#agentlib/logger.js').child({ component: 'test-dt-payload' })

/**
 * Builds an `IncomingPayload` wired to the transaction's agent, matching how
 * `Transaction#acceptDistributedTraceHeaders` constructs it internally.
 *
 * @param {Transaction} txn the transaction under test
 * @returns {IncomingPayload} the payload handler
 */
function makeHandler(txn) {
  return new IncomingPayload({ agent: txn.agent, logger, transaction: txn })
}

test('DistributedTracePayload#parseAndApply', async (t) => {
  t.beforeEach((ctx) => {
    ctx.nr = {}
    const agent = helper.loadMockedAgent({
      distributed_tracing: { enabled: true }
    })
    agent.config.trusted_account_key = '1'
    // Clear deprecated values just to be extra sure.
    agent.config._process_id = null
    agent.config.account_ids = null

    agent.recordSupportability = sinon.spy()

    ctx.nr.agent = agent
    ctx.nr.txn = new Transaction(agent)
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
    ctx.nr.agent = null
  })

  await t.test('records supportability metric if no payload was passed', (t) => {
    const { txn } = t.nr
    makeHandler(txn).parseAndApply(null)
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Ignored/Null'
    )
  })

  await t.test(
    'when already marked as distributed trace, records `Multiple` metric if parentId exists',
    (t) => {
      const { txn } = t.nr
      txn.isDistributedTrace = true
      txn.parentId = 'exists'

      makeHandler(txn).parseAndApply('{}')
      assert.equal(
        txn.agent.recordSupportability.args[0][0],
        'DistributedTrace/AcceptPayload/Ignored/Multiple'
      )
    }
  )

  await t.test(
    'when already marked as distributed trace, records `CreateBeforeAccept` metric if parentId does not exist',
    (t) => {
      const { txn } = t.nr
      txn.isDistributedTrace = true

      makeHandler(txn).parseAndApply('{}')
      assert.equal(
        txn.agent.recordSupportability.args[0][0],
        'DistributedTrace/AcceptPayload/Ignored/CreateBeforeAccept'
      )
    }
  )

  await t.test('should not accept payload if no configured trusted key', (t) => {
    const { txn } = t.nr
    txn.agent.config.trusted_account_key = null
    txn.agent.config.account_id = null

    const payload = new Payload({
      input: {
        v: [0, 1],
        d: { ac: '1', ty: 'App', tx: txn.id, tr: txn.id, ap: 'test', ti: Date.now() - 1 }
      }
    })

    makeHandler(txn).parseAndApply(JSON.stringify(payload))

    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Exception'
    )
    assert.ok(!txn.isDistributedTrace)
  })

  await t.test('should not accept payload if DT disabled', (t) => {
    const { txn } = t.nr
    txn.agent.config.distributed_tracing.enabled = false

    const payload = new Payload({
      input: {
        v: [0, 1],
        d: { ac: '1', ty: 'App', tx: txn.id, tr: txn.id, ap: 'test', ti: Date.now() - 1 }
      }
    })

    makeHandler(txn).parseAndApply(JSON.stringify(payload))

    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Exception'
    )
    assert.ok(!txn.isDistributedTrace)
  })

  await t.test('should accept payload if config valid and CAT disabled', (t) => {
    const { txn } = t.nr

    const payload = new Payload({
      input: {
        v: [0, 1],
        d: { ac: '1', ty: 'App', tx: txn.id, tr: txn.id, ap: 'test', ti: Date.now() - 1 }
      }
    })

    makeHandler(txn).parseAndApply(JSON.stringify(payload))

    assert.ok(txn.isDistributedTrace)
  })

  await t.test('fails if payload version is above agent-supported version', (t) => {
    const { txn } = t.nr
    makeHandler(txn).parseAndApply(JSON.stringify({ v: [1, 0] }))
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/ParseException'
    )
    assert.ok(!txn.isDistributedTrace)
  })

  await t.test('fails if payload account id is not in trusted ids', (t) => {
    const { txn } = t.nr
    const payload = new Payload({
      input: {
        v: [0, 1],
        d: { ac: 2, ty: 'App', id: txn.id, tr: txn.id, ap: 'test', ti: Date.now() }
      }
    })

    makeHandler(txn).parseAndApply(JSON.stringify(payload))
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Ignored/UntrustedAccount'
    )
    assert.ok(!txn.isDistributedTrace)
  })

  await t.test('fails if payload data is missing required keys', (t) => {
    const { txn } = t.nr
    makeHandler(txn).parseAndApply(JSON.stringify({ v: [0, 1], d: { ac: 1 } }))
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/ParseException'
    )
    assert.ok(!txn.isDistributedTrace)
  })

  await t.test('takes the priority and sampled state from the incoming payload', (t) => {
    const { txn } = t.nr
    const payload = new Payload({
      input: {
        v: [0, 1],
        d: {
          ac: '1',
          ty: 'App',
          id: txn.id,
          tr: txn.id,
          ap: 'test',
          pr: 1.9999999,
          sa: true,
          ti: Date.now()
        }
      }
    })

    makeHandler(txn).parseAndApply(JSON.stringify(payload))
    assert.ok(txn.sampled)
    assert.equal(txn.priority, payload.data.pr)
    // Should not truncate accepted priority
    assert.equal(txn.priority.toString().length, 9)
  })

  await t.test('does not take the distributed tracing data if priority is missing', (t) => {
    const { txn } = t.nr
    const payload = new Payload({
      input: {
        v: [0, 1],
        d: { ac: 1, ty: 'App', id: txn.id, tr: txn.id, ap: 'test', sa: true, ti: Date.now() }
      }
    })

    makeHandler(txn).parseAndApply(JSON.stringify(payload))
    assert.equal(txn.priority, null)
    assert.equal(txn.sampled, null)
  })

  await t.test('stores payload props on transaction', (t) => {
    const { txn } = t.nr
    const payload = new Payload({
      input: {
        v: [0, 1],
        d: { ac: '1', ty: 'App', tx: txn.id, tr: txn.id, ap: 'test', ti: Date.now() - 1 }
      }
    })

    makeHandler(txn).parseAndApply(JSON.stringify(payload))
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Success'
    )
    assert.equal(txn.parentId, payload.data.tx)
    assert.equal(txn.parentType, payload.data.ty)
    assert.equal(txn.traceId, payload.data.tr)
    assert.ok(txn.isDistributedTrace)
    assert.ok(txn.parentTransportDuration > 0)
  })

  await t.test('should 0 transport duration when receiving payloads from the future', (t) => {
    const { txn } = t.nr
    const payload = new Payload({
      input: {
        v: [0, 1],
        d: {
          ac: '1',
          ty: 'App',
          tx: txn.id,
          id: txn.trace.root.id,
          tr: txn.id,
          ap: 'test',
          ti: Date.now() + 1000
        }

      }
    })
    makeHandler(txn).parseAndApply(JSON.stringify(payload))
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/Success'
    )
    assert.equal(txn.parentId, payload.data.tx)
    assert.equal(txn.parentSpanId, txn.trace.root.id)
    assert.equal(txn.parentType, payload.data.ty)
    assert.equal(txn.traceId, payload.data.tr)
    assert.ok(txn.isDistributedTrace)
    assert.equal(txn.parentTransportDuration, 0)
  })

  // Parsing behaviors migrated from the former `_getParsedPayload` tests.
  await t.test('accepts a plain JSON string payload', (t) => {
    const { txn } = t.nr
    const payload = new Payload({
      input: {
        v: [0, 1],
        d: { ac: '1', ty: 'App', tx: txn.id, tr: txn.id, ap: 'test', ti: Date.now() - 1 }
      }
    })

    makeHandler(txn).parseAndApply(JSON.stringify(payload))
    assert.ok(txn.isDistributedTrace)
    assert.equal(txn.traceId, payload.data.tr)
  })

  await t.test('accepts a base64-encoded JSON string payload', (t) => {
    const { txn } = t.nr
    const payload = new Payload({
      input: {
        v: [0, 1],
        d: { ac: '1', ty: 'App', tx: txn.id, tr: txn.id, ap: 'test', ti: Date.now() - 1 }
      }
    })
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')

    makeHandler(txn).parseAndApply(encoded)
    assert.ok(txn.isDistributedTrace)
    assert.equal(txn.traceId, payload.data.tr)
  })

  await t.test('rejects an invalid JSON string with a ParseException metric', (t) => {
    const { txn } = t.nr
    makeHandler(txn).parseAndApply('{invalid JSON string}')
    assert.equal(
      txn.agent.recordSupportability.args[0][0],
      'DistributedTrace/AcceptPayload/ParseException'
    )
    assert.ok(!txn.isDistributedTrace)
  })

  await t.test('rejects a non-string payload without applying', (t) => {
    const { txn } = t.nr
    makeHandler(txn).parseAndApply({ v: [0, 1], d: { ac: '1' } })
    assert.ok(!txn.isDistributedTrace)
  })
})
