/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const Tracestate = require('#agentlib/w3c/tracestate.js')
const helper = require('#testlib/agent_helper.js')

test('instances from header values', async t => {
  t.beforeEach(ctx => {
    ctx.nr = {}
    ctx.nr.agent = helper.loadMockedAgent()
  })

  t.afterEach(ctx => {
    helper.unloadAgent(ctx.nr.agent)
  })

  await t.test('rejects non-string values', (t) => {
    const { agent } = t.nr
    const expected = /header value must be a string/
    assert.throws(() => Tracestate.fromHeader({ header: Buffer.from(''), agent }), expected)
    assert.throws(() => Tracestate.fromHeader({ header: 42, agent }), expected)
  })

  await t.test('agent must be an agent instance', t => {
    const agent = {}
    const expected = /agent must be an agent instance/
    assert.throws(() => Tracestate.fromHeader({ header: '', agent }), expected)
  })

  await t.test('parses w3c combined example correctly', t => {
    // See https://www.w3.org/TR/trace-context/#combined-header-value
    const { agent } = t.nr
    const header = 'congo=congosFirstPosition,rojo=rojosFirstPosition,congo=congosSecondPosition'
    const expected = 'congo=congosSecondPosition,rojo=rojosFirstPosition'

    const tracestate = Tracestate.fromHeader({ header, agent })
    assert.ok(tracestate)
    assert.equal(tracestate.toString(), expected)
    assert.deepStrictEqual(tracestate.vendors, ['congo', 'rojo'])
    assert.equal(agent.__mocks.supportability.get('TraceContext/TraceState/NoNrEntry'), 1)
  })

  await t.test('records logs when no nr tracestate present', t => {
    const { agent } = t.nr

    let recordedMsg
    const logger = {
      debug(msg) { recordedMsg = msg }
    }

    Tracestate.fromHeader({
      header: 'foo=bar',
      agent,
      logger
    })
    assert.equal(recordedMsg, [
      'Unable to accept any New Relic tracestate list members. ',
      'Missing trusted_account_key. ',
      'This may occur if a trace is received prior to the agent fully starting.'
    ].join(''))
    assert.equal(agent.__mocks.supportability.get('TraceContext/TraceState/Accept/Exception'), 1)
  })

  await t.test('throws for bad list members', t => {
    const { agent } = t.nr
    let recordedMsg
    const logger = {
      debug(msg) { recordedMsg = msg }
    }
    const expected = /list member is not in parseable format/
    assert.throws(() => Tracestate.fromHeader({ header: 'foo=', agent, logger }), expected)
    assert.equal(recordedMsg, 'Unable to parse tracestate list members.')
    assert.equal(agent.__mocks.supportability.get('TraceContext/TraceState/Parse/Exception/ListMember'), 1)
  })

  await t.test('should pass a valid tracestate header', (t) => {
    const { agent } = t.nr
    agent.config.trusted_account_key = '190'
    const goodTraceStateHeader =
      '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827,234234@foo=bar'

    const valid = Tracestate.fromHeader({ header: goodTraceStateHeader, agent })
    assert.ok(valid)
    assert.ok(valid.intrinsics)
    assert.equal(valid.intrinsics.version, 0)
    assert.equal(valid.intrinsics.parentType, 'App')
    assert.equal(valid.intrinsics.accountId, '709288')
    assert.equal(valid.intrinsics.appId, '8599547')
    assert.equal(valid.intrinsics.spanId, 'f85f42fd82a4cf1d')
    assert.equal(valid.intrinsics.transactionId, '164d3b4b0d09cb05')
    assert.equal(valid.intrinsics.sampled, true)
    assert.equal(valid.intrinsics.priority, 0.789)
    assert.equal(valid.intrinsics.timestamp, 1563574856827)
  })

  await t.test('should fail mismatched trusted account ID in tracestate header', (t) => {
    const { agent } = t.nr
    agent.config.trusted_account_key = '666'
    const badTraceStateHeader =
      '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827,234234@foo=bar'
    const valid = Tracestate.fromHeader({ header: badTraceStateHeader, agent })

    assert.equal(agent.__mocks.supportability.get('TraceContext/TraceState/NoNrEntry'), 1)
    assert.equal(valid.intrinsics, undefined)
  })

  await t.test('should fail with bad timestamp in tracestate header', (ctx) => {
    const { agent } = ctx.nr
    agent.config.trusted_account_key = '190'
    const badTimestamp =
      '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-,234234@foo=bar'
    const valid = Tracestate.fromHeader({ header: badTimestamp, agent })
    assert.equal(valid.intrinsics.isValid, false)
    assert.equal(valid.intrinsics.invalidReason, 'timestamp failed validation test')
  })

  await t.test('should handle empty priority and sampled fields (mobile payload)', (t) => {
    const { agent } = t.nr
    agent.config.trusted_account_key = '190'
    const goodTraceStateHeader =
      '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05---1563574856827,234234@foo=bar'
    const valid = Tracestate.fromHeader({ header: goodTraceStateHeader, agent })
    assert.ok(valid)
    assert.ok(valid.intrinsics)
    assert.equal(valid.intrinsics.version, 0)
    assert.equal(valid.intrinsics.parentType, 'App')
    assert.equal(valid.intrinsics.accountId, '709288')
    assert.equal(valid.intrinsics.appId, '8599547')
    assert.equal(valid.intrinsics.spanId, 'f85f42fd82a4cf1d')
    assert.equal(valid.intrinsics.transactionId, '164d3b4b0d09cb05')
    assert.equal(valid.intrinsics.sampled, null)
    assert.equal(valid.intrinsics.priority, null)
    assert.equal(valid.intrinsics.timestamp, 1563574856827)
  })
})
