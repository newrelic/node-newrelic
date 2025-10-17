/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const helper = require('../../lib/agent_helper')
const Traceparent = require('#agentlib/w3c/traceparent.js')
const Tracestate = require('#agentlib/w3c/tracestate.js')
const Transaction = require('#agentlib/transaction.js')
const TraceContext = require('#agentlib/transaction/tracecontext.js').TraceContext
const sinon = require('sinon')

test('TraceContext', async function (t) {
  const supportabilitySpy = sinon.spy()

  function beforeEach(ctx) {
    const agent = helper.loadMockedAgent({
      attributes: { enabled: true }
    })

    agent.config.distributed_tracing.account_id = 'AccountId1'
    agent.config.distributed_tracing.primary_application_id = 'AppId1'
    agent.config.distributed_tracing.trusted_account_key = 33
    agent.config.distributed_tracing.enabled = true

    agent.recordSupportability = supportabilitySpy

    const transaction = new Transaction(agent)
    ctx.nr = {}
    ctx.nr.traceContext = new TraceContext(transaction)
    ctx.nr.transaction = transaction
    ctx.nr.agent = agent
  }

  function afterEach(ctx) {
    supportabilitySpy.resetHistory()
    helper.unloadAgent(ctx.nr.agent)
  }

  await t.test('acceptTraceContextPayload', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    await t.test('should accept valid trace context headers', (ctx) => {
      const { traceContext, transaction } = ctx.nr
      const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'

      const tracestate = `33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-${Date.now()}`

      const tcd = traceContext.acceptTraceContextPayload(traceparent, tracestate)
      assert.equal(Object.prototype.toString.call(tcd.traceparent), '[object Traceparent]')
      assert.equal(Object.prototype.toString.call(tcd.tracestate), '[object Tracestate]')
      assert.equal(tcd.traceparent.traceId, '00015f9f95352ad550284c27c5d3084c')
      assert.equal(tcd.traceparent.parentId, '00f067aa0ba902b7')
      assert.equal(tcd.tracestate.parentType, 'App')
      assert.equal(tcd.tracestate.parentAccountId, '33')
      assert.equal(tcd.tracestate.parentAppId, '2827902')
      assert.equal(tcd.tracestate.transactionId, 'e8b91a159289ff74')
      assert.equal(tcd.tracestate.sampled, true)
      assert.equal(tcd.tracestate.priority, 1.23456)
      assert.ok(transaction.parentTransportDuration < 10)
      assert.ok(transaction.parentTransportDuration >= 0)
    })

    await t.test('should not accept an empty traceparent header', (ctx) => {
      const { traceContext } = ctx.nr
      const tcd = traceContext.acceptTraceContextPayload(null, '')
      assert.equal(tcd.traceparent, undefined)
    })

    await t.test('should not accept an invalid traceparent header', (ctx) => {
      const { traceContext } = ctx.nr
      const tcd = traceContext.acceptTraceContextPayload('invalid', '')
      assert.equal(tcd.traceparent, undefined)
    })

    await t.test('should not accept an invalid tracestate header', (ctx) => {
      const { traceContext } = ctx.nr
      const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
      const tracestate = 'asdf,===asdf,,'
      const tcd = traceContext.acceptTraceContextPayload(traceparent, tracestate)

      assert.equal(supportabilitySpy.callCount, 2)
      assert.equal(supportabilitySpy.secondCall.args[0], 'TraceContext/TraceState/Parse/Exception')

      assert.ok(tcd.traceparent)
      assert.equal(tcd.tracestate, undefined)
    })

    await t.test('should accept traceparent when tracestate missing', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = false

      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        agent.tracer.setSegment({ segment: childSegment })
        childSegment.start()

        txn.acceptTraceContextPayload(traceparent, undefined)

        // The traceId should propagate
        const newTraceparent = txn.traceContext.createTraceparent()
        assert.ok(newTraceparent.startsWith('00-4bf92f3577b34da6a'))

        txn.end()
        end()
      })
    })

    await t.test('should accept traceparent when tracestate empty string', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = false

      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      const tracestate = ''

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        agent.tracer.setSegment({ segment: childSegment })
        childSegment.start()

        txn.acceptTraceContextPayload(traceparent, tracestate)

        // The traceId should propagate
        const newTraceparent = txn.traceContext.createTraceparent()
        assert.ok(newTraceparent.startsWith('00-4bf92f3577b34da6a'))

        txn.end()
        end()
      })
    })

    await t.test('should not fail when tracestate header is missing', (t, end) => {
      const { agent } = t.nr
      agent.config.distributed_tracing.enabled = true

      helper.runInTransaction(agent, (tx) => {
        const childSegment = tx.trace.add('child')
        agent.tracer.setSegment({ segment: childSegment })
        childSegment.start()

        tx.acceptTraceContextPayload('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00', undefined)

        assert.equal(tx.agent.recordSupportability.args.flat(1).includes('TraceContext/TraceState/Parse/Exception'), false)

        tx.end()
        end()
      })
    })
  })

  await t.test('flags hex', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('should parse trace flags in the traceparent header', function (ctx) {
      const { traceContext } = ctx.nr
      let flags = traceContext.parseFlagsHex('01')
      assert.ok(flags.sampled)

      flags = traceContext.parseFlagsHex('00')
      assert.ok(!flags.sampled)
    })

    await t.test('should return proper trace flags hex', function (ctx) {
      const { transaction, traceContext } = ctx.nr
      transaction.sampled = false
      let flagsHex = traceContext.createFlagsHex()
      assert.equal(flagsHex, '00')

      transaction.sampled = true
      flagsHex = traceContext.createFlagsHex()
      assert.equal(flagsHex, '01')
    })
  })

  await t.test('header creation', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    await t.test('creating traceparent twice should give the same value', function (ctx, end) {
      const { agent } = ctx.nr
      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        agent.tracer.setSegment({ segment: childSegment })
        childSegment.start()

        const tp1 = txn.traceContext.createTraceparent()
        const tp2 = txn.traceContext.createTraceparent()

        assert.equal(tp1, tp2)
        txn.end()
        end()
      })
    })

    await t.test('should create valid headers', (ctx, end) => {
      const { agent } = ctx.nr
      const trustedKey = '19000'
      const accountId = '190'
      const appId = '109354'
      agent.config.distributed_tracing.trusted_account_key = trustedKey
      agent.config.distributed_tracing.account_id = accountId
      agent.config.distributed_tracing.primary_application_id = appId
      agent.transactionSampler.shouldSample = () => false

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        agent.tracer.setSegment({ segment: childSegment })
        childSegment.start()

        const headers = getTraceContextHeaders(txn)
        assert.ok(Traceparent.fromHeader(headers.traceparent))
        assert.ok(Tracestate.fromHeader({ header: headers.tracestate, agent }))
        assert.equal(headers.tracestate.split('=')[0], `${trustedKey}@nr`)
        assert.equal(headers.tracestate.split('-')[6], '0')
        assert.equal(headers.tracestate.split('-')[3], appId)
        assert.equal(headers.tracestate.split('-')[2], accountId)

        txn.end()
        end()
      })
    })

    await t.test('should accept first valid nr entry when duplicate entries exist', (ctx, end) => {
      const { agent } = ctx.nr
      const acctKey = '190'
      agent.config.distributed_tracing.trusted_account_key = acctKey
      const duplicateAcctTraceState =

        '42@bar=foo,190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827,190@nr=bar'
      const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
      const appId = '109354'

      agent.config.distributed_tracing.trusted_account_key = acctKey
      agent.config.distributed_tracing.account_id = acctKey
      agent.config.distributed_tracing.primary_application_id = appId
      agent.transactionSampler.shouldSample = () => false

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        agent.tracer.setSegment({ segment: childSegment })
        childSegment.start()

        txn.traceContext.acceptTraceContextPayload(traceparent, duplicateAcctTraceState)
        const valid = Tracestate.fromHeader({ header: duplicateAcctTraceState, agent })
        const traceContextPayload = getTraceContextHeaders(txn)

        assert.ok(valid.intrinsics)
        assert.ok(!valid.vendors.includes(`${acctKey}@nr`))
        const nrMatch = traceContextPayload.tracestate.match(/190@nr/g) || []
        assert.equal(nrMatch.length, 1, 'has only one nr entry')

        const nonNrMatch = traceContextPayload.tracestate.match(/42@bar/g) || []
        assert.equal(nonNrMatch.length, 1, 'contains non-nr entry')

        txn.end()
        end()
      })
    })

    await t.test(
      'should not accept first nr entry when duplicate entries exist and its invalid',
      (ctx, end) => {
        const { agent } = ctx.nr
        const acctKey = '190'
        agent.config.distributed_tracing.trusted_account_key = acctKey
        const duplicateAcctTraceState =

          '190@nr=bar,42@bar=foo,190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827'
        const valid = Tracestate.fromHeader({ header: duplicateAcctTraceState, agent })

        assert.ok(valid.intrinsics, true)
        assert.equal(valid.intrinsics.isValid, false)
        assert.equal(valid.vendors.includes(`${acctKey}@nr`), false)
        end()
      }
    )

    await t.test('should propagate headers', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = false

      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      const tracestate = 'test=test'

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        agent.tracer.setSegment({ segment: childSegment })
        childSegment.start()

        txn.acceptTraceContextPayload(traceparent, tracestate)

        const headers = getTraceContextHeaders(txn)

        // The parentId (current span id) of traceparent will change, but the traceId
        // should propagate
        assert.ok(headers.traceparent.startsWith('00-4bf92f3577b34da6a'))

        // The test key/value should propagate at the end of the string
        assert.ok(headers.tracestate.endsWith(tracestate))

        txn.end()
        end()
      })
    })

    await t.test('should generate parentId if no span/segment in context', (ctx, end) => {
      const { agent } = ctx.nr
      // This is a corner case and ideally never happens but is potentially possible
      // due to state loss.

      agent.config.distributed_tracing.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedVersion = '00'
      const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
      const traceparent = `${expectedVersion}-${expectedTraceId}-00f067aa0ba902b7-00`
      const tracestate = 'test=test'

      helper.runInTransaction(agent, function (txn) {
        helper.runOutOfContext(() => {
          txn.acceptTraceContextPayload(traceparent, tracestate)

          const headers = getTraceContextHeaders(txn)

          const splitData = headers.traceparent.split('-')
          const [version, traceId, parentId] = splitData

          assert.equal(version, expectedVersion)
          assert.equal(traceId, expectedTraceId)

          assert.ok(parentId) // we should generate *something*
          assert.equal(parentId.length, 16) // and it should be 16 chars

          txn.end()
          end()
        })
      })
    })

    await t.test('should not generate spanId if no span/segment in context', (ctx, end) => {
      const { agent } = ctx.nr
      // This is a corner case and ideally never happens but is potentially possible
      // due to state loss.

      agent.config.distributed_tracing.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedVersion = '00'
      const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
      const traceparent = `${expectedVersion}-${expectedTraceId}-00f067aa0ba902b7-00`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function (txn) {
        helper.runOutOfContext(() => {
          txn.acceptTraceContextPayload(traceparent, incomingTraceState)

          const outboundHeaders = getTraceContextHeaders(txn)
          const tracestate = outboundHeaders.tracestate

          // The test key/value should propagate at the end of the string
          assert.ok(tracestate.endsWith(incomingTraceState))

          const secondListMemberIndex = tracestate.indexOf(incomingTraceState)
          const nrItem = tracestate.substring(0, secondListMemberIndex)

          const splitData = nrItem.split('-')
          const { 4: spanId } = splitData

          assert.equal(spanId, '')

          txn.end()
        })
        end()
      })
    })

    await t.test('should generate new trace when receiving invalid traceparent', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const unexpectedTraceId = '12345678901234567890123456789012'
      // version 255 (ff) is forbidden...
      const traceparent = `ff-${unexpectedTraceId}-1234567890123456-01`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function (txn) {
        txn.acceptTraceContextPayload(traceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [version, traceId] = splitData

        assert.equal(version, '00')
        assert.ok(traceId)
        assert.notEqual(traceId, unexpectedTraceId)

        txn.end()

        end()
      })
    })

    await t.test('should handle combined headers with empty values', (ctx, end) => {
      const { agent } = ctx.nr
      // The http module will automatically combine headers
      // In the case of combining ['tracestate', ''] and ['tracestate', 'foo=1']
      // An incoming header may look like tracestate: 'foo=1, '.
      agent.config.distributed_tracing.account_id = 'AccountId1'
      agent.config.distributed_tracing.primary_application_id = 'AppId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedTraceId = '12345678901234567890123456789012'
      const futureTraceparent = `\t 00-${expectedTraceId}-1234567890123456-01 \t`
      const incomingTraceState = 'foo=1, '

      helper.runInTransaction(agent, function (txn) {
        txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [, traceId] = splitData

        assert.equal(traceId, expectedTraceId)

        const tracestate = headers.tracestate
        const listMembers = tracestate.split(',')

        const [, fooMember] = listMembers

        assert.equal(fooMember, 'foo=1')

        txn.end()
        end()
      })
    })

    await t.test(
      'should propagate existing list members when cannot accept newrelic list members',
      (ctx, end) => {
        const { agent } = ctx.nr
        // missing trust key means can't accept/match newrelic header
        agent.config.distributed_tracing.trusted_account_key = null
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = false

        const incomingTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
        const incomingTracestate =
          '33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-1518469636035,test=test'

        helper.runInTransaction(agent, function (txn) {
          const childSegment = txn.trace.add('child')
          agent.tracer.setSegment({ segment: childSegment })
          childSegment.start()

          txn.acceptTraceContextPayload(incomingTraceparent, incomingTracestate)

          assert.equal(supportabilitySpy.callCount, 3)

          assert.equal(
            supportabilitySpy.firstCall.args[0],
            'TraceContext/TraceState/Accept/Exception'
          )

          const headers = getTraceContextHeaders(txn)
          // The parentId (current span id) of traceparent will change, but the traceId
          // should propagate
          assert.ok(headers.traceparent.startsWith('00-4bf92f3577b34da6a'))

          // The original tracestate should be propagated
          assert.equal(headers.tracestate, incomingTracestate)

          txn.end()

          end()
        })
      }
    )

    await t.test(
      'should propagate existing when cannot accept or generate newrelic list member',
      (ctx, end) => {
        const { agent } = ctx.nr
        agent.config.distributed_tracing.trusted_account_key = null
        agent.config.distributed_tracing.account_id = null
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = false

        const incomingTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
        const incomingTracestate =
          '33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-1518469636035,test=test'

        helper.runInTransaction(agent, function (txn) {
          const childSegment = txn.trace.add('child')
          agent.tracer.setSegment({ segment: childSegment })
          childSegment.start()

          txn.acceptTraceContextPayload(incomingTraceparent, incomingTracestate)

          const headers = getTraceContextHeaders(txn)
          // The parentId (current span id) of traceparent will change, but the traceId
          // should propagate
          assert.ok(headers.traceparent.startsWith('00-4bf92f3577b34da6a'))

          // The original tracestate should be propagated
          assert.equal(headers.tracestate, incomingTracestate)

          txn.end()
          end()
        })
      }
    )

    await t.test('should handle leading white space', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedTraceId = '12345678901234567890123456789012'
      const futureTraceparent = ` 00-${expectedTraceId}-1234567890123456-01`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function (txn) {
        txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [, traceId] = splitData

        assert.equal(traceId, expectedTraceId)

        txn.end()
        end()
      })
    })

    await t.test('should handle leading tab', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedTraceId = '12345678901234567890123456789012'
      const futureTraceparent = `\t00-${expectedTraceId}-1234567890123456-01`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function (txn) {
        txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [, traceId] = splitData

        assert.equal(traceId, expectedTraceId)

        txn.end()
        end()
      })
    })

    await t.test('should handle trailing white space', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedTraceId = '12345678901234567890123456789012'
      const futureTraceparent = `00-${expectedTraceId}-1234567890123456-01 `
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function (txn) {
        txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [, traceId] = splitData

        assert.equal(traceId, expectedTraceId)

        txn.end()
        end()
      })
    })

    await t.test('should handle white space and tabs for a single item', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedTraceId = '12345678901234567890123456789012'
      const futureTraceparent = `00-${expectedTraceId}-1234567890123456-01`
      const incomingTraceState = '\t foo=1 \t'

      helper.runInTransaction(agent, function (txn) {
        txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [, traceId] = splitData

        assert.equal(traceId, expectedTraceId)

        const tracestate = headers.tracestate
        const listMembers = tracestate.split(',')

        const [, fooMember] = listMembers
        assert.equal(fooMember, 'foo=1')

        txn.end()
        end()
      })
    })

    await t.test('should handle white space and tabs between list members', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedTraceId = '12345678901234567890123456789012'
      const futureTraceparent = `00-${expectedTraceId}-1234567890123456-01`
      const incomingTraceState = 'foo=1 \t , \t bar=2, \t baz=3'

      helper.runInTransaction(agent, function (txn) {
        txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [, traceId] = splitData

        assert.equal(traceId, expectedTraceId)

        const tracestate = headers.tracestate
        const listMembers = tracestate.split(',')

        const [, fooMember, barMember, bazMember] = listMembers

        assert.equal(fooMember, 'foo=1')
        assert.equal(barMember, 'bar=2')
        assert.equal(bazMember, 'baz=3')

        txn.end()
        end()
      })
    })

    await t.test('should handle trailing tab', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedTraceId = '12345678901234567890123456789012'
      const futureTraceparent = `00-${expectedTraceId}-1234567890123456-01\t`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function (txn) {
        txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [, traceId] = splitData

        assert.equal(traceId, expectedTraceId)

        txn.end()
        end()
      })
    })

    await t.test('should handle leading and trailing white space and tabs', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedTraceId = '12345678901234567890123456789012'
      const futureTraceparent = `\t 00-${expectedTraceId}-1234567890123456-01 \t`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function (txn) {
        txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [, traceId] = splitData

        assert.equal(traceId, expectedTraceId)

        txn.end()
        end()
      })
    })
  })

  await t.test('should gracefully handle missing required tracestate fields', async (t) => {
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    // During startup, there is a period of time where we may notice outbound
    // requests (or via API call) and attempt to create traces before receiving
    // required fields from server.

    await t.test('should not create tracestate when accountId is missing', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.account_id = null
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      helper.runInTransaction(agent, function (txn) {
        const headers = {}
        txn.traceContext.addTraceContextHeaders(headers)

        assert.ok(headers.traceparent)
        assert.ok(!headers.tracestate)

        assert.equal(supportabilitySpy.callCount, 2)

        assert.equal(
          supportabilitySpy.firstCall.args[0],
          'TraceContext/TraceState/Create/Exception'
        )

        txn.end()
        end()
      })
    })

    await t.test('should not create tracestate when primary_application_id missing', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.account_id = '12345'
      agent.config.distributed_tracing.primary_application_id = null
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      helper.runInTransaction(agent, function (txn) {
        const headers = {}
        txn.traceContext.addTraceContextHeaders(headers)

        assert.ok(headers.traceparent)
        assert.ok(!headers.tracestate)

        assert.equal(supportabilitySpy.callCount, 2)

        assert.equal(
          supportabilitySpy.firstCall.args[0],
          'TraceContext/TraceState/Create/Exception'
        )

        txn.end()
        end()
      })
    })

    await t.test('should not create tracestate when trusted_account_key missing', (ctx, end) => {
      const { agent } = ctx.nr
      agent.config.distributed_tracing.account_id = '12345'
      agent.config.distributed_tracing.primary_application_id = 'appId'
      agent.config.distributed_tracing.trusted_account_key = null
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      helper.runInTransaction(agent, function (txn) {
        const headers = {}
        txn.traceContext.addTraceContextHeaders(headers)

        assert.ok(headers.traceparent)
        assert.ok(!headers.tracestate)

        assert.equal(supportabilitySpy.callCount, 2)

        assert.equal(
          supportabilitySpy.firstCall.args[0],
          'TraceContext/TraceState/Create/Exception'
        )

        txn.end()

        end()
      })
    })
  })
})

function getTraceContextHeaders(transaction) {
  const headers = {}
  transaction.traceContext.addTraceContextHeaders(headers)
  return headers
}
