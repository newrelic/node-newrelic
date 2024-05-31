/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const helper = require('../../lib/agent_helper')
const Transaction = require('../../../lib/transaction')
const TraceContext = require('../../../lib/transaction/tracecontext').TraceContext
const sinon = require('sinon')

tap.test('TraceContext', function (t) {
  t.autoend()
  const supportabilitySpy = sinon.spy()

  function beforeEach(t) {
    const agent = helper.loadMockedAgent({
      attributes: { enabled: true }
    })

    agent.config.account_id = 'AccountId1'
    agent.config.primary_application_id = 'AppId1'
    agent.config.trusted_account_key = 33
    agent.config.distributed_tracing.enabled = true

    agent.recordSupportability = supportabilitySpy

    const transaction = new Transaction(agent)
    t.context.traceContext = new TraceContext(transaction)
    t.context.transaction = transaction
    t.context.agent = agent
  }

  function afterEach(t) {
    supportabilitySpy.resetHistory()
    helper.unloadAgent(t.context.agent)
  }

  t.test('acceptTraceContextPayload', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)

    t.test('should accept valid trace context headers', (t) => {
      const { traceContext } = t.context
      const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
      // eslint-disable-next-line max-len
      const tracestate = `33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-${Date.now()}`

      const tcd = traceContext.acceptTraceContextPayload(traceparent, tracestate)
      t.equal(tcd.acceptedTraceparent, true)
      t.equal(tcd.acceptedTracestate, true)
      t.equal(tcd.traceId, '00015f9f95352ad550284c27c5d3084c')
      t.equal(tcd.parentSpanId, '00f067aa0ba902b7')
      t.equal(tcd.parentType, 'App')
      t.equal(tcd.accountId, '33')
      t.equal(tcd.appId, '2827902')
      t.equal(tcd.transactionId, 'e8b91a159289ff74')
      t.equal(tcd.sampled, true)
      t.equal(tcd.priority, 1.23456)
      t.ok(tcd.transportDuration < 10)
      t.ok(tcd.transportDuration >= 0)
      t.end()
    })

    t.test('should not accept an empty traceparent header', (t) => {
      const { traceContext } = t.context
      const tcd = traceContext.acceptTraceContextPayload(null, '')
      t.equal(tcd.acceptedTraceparent, false)
      t.end()
    })

    t.test('should not accept an invalid traceparent header', (t) => {
      const { traceContext } = t.context
      const tcd = traceContext.acceptTraceContextPayload('invalid', '')
      t.equal(tcd.acceptedTraceparent, false)
      t.end()
    })

    t.test('should not accept an invalid tracestate header', (t) => {
      const { traceContext } = t.context
      const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
      const tracestate = 'asdf,===asdf,,'
      const tcd = traceContext.acceptTraceContextPayload(traceparent, tracestate)

      t.equal(supportabilitySpy.callCount, 2)
      t.equal(supportabilitySpy.secondCall.args[0], 'TraceContext/TraceState/Parse/Exception')

      t.equal(tcd.acceptedTraceparent, true)
      t.equal(tcd.acceptedTracestate, false)
      t.end()
    })

    t.test('should accept traceparent when tracestate missing', (t) => {
      const { agent } = t.context
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = false

      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.acceptTraceContextPayload(traceparent, undefined)

        // The traceId should propagate
        const newTraceparent = txn.traceContext.createTraceparent()
        t.ok(newTraceparent.startsWith('00-4bf92f3577b34da6a'))

        txn.end()
        t.end()
      })
    })

    t.test('should accept traceparent when tracestate empty string', (t) => {
      const { agent } = t.context
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = false

      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      const tracestate = ''

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.acceptTraceContextPayload(traceparent, tracestate)

        // The traceId should propagate
        const newTraceparent = txn.traceContext.createTraceparent()
        t.ok(newTraceparent.startsWith('00-4bf92f3577b34da6a'))

        txn.end()
        t.end()
      })
    })
  })

  t.test('flags hex', function (t) {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should parse trace flags in the traceparent header', function (t) {
      const { traceContext } = t.context
      let flags = traceContext.parseFlagsHex('01')
      t.ok(flags.sampled)

      flags = traceContext.parseFlagsHex('00')
      t.notOk(flags.sampled)
      t.end()
    })

    t.test('should return proper trace flags hex', function (t) {
      const { transaction, traceContext } = t.context
      transaction.sampled = false
      let flagsHex = traceContext.createFlagsHex()
      t.equal(flagsHex, '00')

      transaction.sampled = true
      flagsHex = traceContext.createFlagsHex()
      t.equal(flagsHex, '01')
      t.end()
    })
  })

  t.test('_validateAndParseTraceParentHeader', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should pass valid traceparent header', (t) => {
      const { traceContext } = t.context
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      t.ok(traceContext._validateAndParseTraceParentHeader(traceparent).entryValid)
      t.end()
    })

    t.test('should not pass 32 char string of all zeroes in traceid part of header', (t) => {
      const { traceContext } = t.context
      const allZeroes = '00-00000000000000000000000000000000-00f067aa0ba902b7-00'

      t.equal(traceContext._validateAndParseTraceParentHeader(allZeroes).entryValid, false)
      t.end()
    })

    t.test('should not pass 16 char string of all zeroes in parentid part of header', (t) => {
      const { traceContext } = t.context
      const allZeroes = '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-00'

      t.equal(traceContext._validateAndParseTraceParentHeader(allZeroes).entryValid, false)
      t.end()
    })

    t.test('should not pass when traceid part contains uppercase letters', (t) => {
      const { traceContext } = t.context
      const someCaps = '00-4BF92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      t.equal(traceContext._validateAndParseTraceParentHeader(someCaps).entryValid, false)
      t.end()
    })

    t.test('should not pass when parentid part contains uppercase letters', (t) => {
      const { traceContext } = t.context
      const someCaps = '00-4bf92f3577b34da6a3ce929d0e0e4736-00FFFFaa0ba902b7-00'

      t.equal(traceContext._validateAndParseTraceParentHeader(someCaps).entryValid, false)
      t.end()
    })

    t.test('should not pass when traceid part contains invalid chars', (t) => {
      const { traceContext } = t.context
      const invalidChar = '00-ZZf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      t.equal(traceContext._validateAndParseTraceParentHeader(invalidChar).entryValid, false)
      t.end()
    })

    t.test('should not pass when parentid part contains invalid chars', (t) => {
      const { traceContext } = t.context
      const invalidChar = '00-aaf92f3577b34da6a3ce929d0e0e4736-00XX67aa0ba902b7-00'

      t.equal(traceContext._validateAndParseTraceParentHeader(invalidChar).entryValid, false)
      t.end()
    })

    t.test('should not pass when tracid part is < 32 char long', (t) => {
      const { traceContext } = t.context
      const shorterStr = '00-4bf92f3-00f067aa0ba902b7-00'

      t.equal(traceContext._validateAndParseTraceParentHeader(shorterStr).entryValid, false)
      t.end()
    })

    t.test('should not pass when tracid part is > 32 char long', (t) => {
      const { traceContext } = t.context
      const longerStr = '00-4bf92f3577b34da6a3ce929d0e0e47366666666-00f067aa0ba902b7-00'

      t.equal(traceContext._validateAndParseTraceParentHeader(longerStr).entryValid, false)
      t.end()
    })

    t.test('should not pass when parentid part is < 16 char long', (t) => {
      const { traceContext } = t.context
      const shorterStr = '00-aaf92f3577b34da6a3ce929d0e0e4736-ff-00'

      t.equal(traceContext._validateAndParseTraceParentHeader(shorterStr).entryValid, false)
      t.end()
    })

    t.test('should not pass when parentid part is > 16 char long', (t) => {
      const { traceContext } = t.context
      const shorterStr = '00-aaf92f3577b34da6a3ce929d0e0e4736-00XX67aa0ba902b72322332-00'

      t.equal(traceContext._validateAndParseTraceParentHeader(shorterStr).entryValid, false)
      t.end()
    })

    t.test('should handle if traceparent is a buffer', (t) => {
      const { traceContext } = t.context
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      const bufferTraceParent = Buffer.from(traceparent, 'utf8')
      t.ok(traceContext._validateAndParseTraceParentHeader(bufferTraceParent).entryValid)
      t.end()
    })
  })

  t.test('_validateAndParseTraceStateHeader', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('should pass a valid tracestate header', (t) => {
      const { agent, traceContext } = t.context
      agent.config.trusted_account_key = '190'
      const goodTraceStateHeader =
        /* eslint-disable-next-line max-len */
        '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827,234234@foo=bar'
      const valid = traceContext._validateAndParseTraceStateHeader(goodTraceStateHeader)
      t.ok(valid)
      t.equal(valid.entryFound, true)
      t.equal(valid.entryValid, true)
      t.equal(valid.intrinsics.version, 0)
      t.equal(valid.intrinsics.parentType, 'App')
      t.equal(valid.intrinsics.accountId, '709288')
      t.equal(valid.intrinsics.appId, '8599547')
      t.equal(valid.intrinsics.spanId, 'f85f42fd82a4cf1d')
      t.equal(valid.intrinsics.transactionId, '164d3b4b0d09cb05')
      t.equal(valid.intrinsics.sampled, true)
      t.equal(valid.intrinsics.priority, 0.789)
      t.equal(valid.intrinsics.timestamp, 1563574856827)
      t.end()
    })

    t.test('should pass a valid tracestate header if a buffer', (t) => {
      const { agent, traceContext } = t.context
      agent.config.trusted_account_key = '190'
      const goodTraceStateHeader =
        /* eslint-disable-next-line max-len */
        '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827,234234@foo=bar'
      const bufferTraceState = Buffer.from(goodTraceStateHeader, 'utf8')
      const valid = traceContext._validateAndParseTraceStateHeader(bufferTraceState)
      t.ok(valid)
      t.equal(valid.entryFound, true)
      t.equal(valid.entryValid, true)
      t.equal(valid.intrinsics.version, 0)
      t.equal(valid.intrinsics.parentType, 'App')
      t.equal(valid.intrinsics.accountId, '709288')
      t.equal(valid.intrinsics.appId, '8599547')
      t.equal(valid.intrinsics.spanId, 'f85f42fd82a4cf1d')
      t.equal(valid.intrinsics.transactionId, '164d3b4b0d09cb05')
      t.equal(valid.intrinsics.sampled, true)
      t.equal(valid.intrinsics.priority, 0.789)
      t.equal(valid.intrinsics.timestamp, 1563574856827)
      t.end()
    })

    t.test('should fail mismatched trusted account ID in tracestate header', (t) => {
      const { agent, traceContext } = t.context
      agent.config.trusted_account_key = '666'
      const badTraceStateHeader =
        /* eslint-disable-next-line max-len */
        '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827,234234@foo=bar'
      const valid = traceContext._validateAndParseTraceStateHeader(badTraceStateHeader)

      t.equal(supportabilitySpy.callCount, 1)
      t.equal(supportabilitySpy.firstCall.args[0], 'TraceContext/TraceState/NoNrEntry')
      t.equal(valid.entryFound, false)
      t.notOk(valid.entryValid)
      t.end()
    })

    t.test('should generate supportability metric when vendor list parsing fails', (t) => {
      const { agent, traceContext } = t.context
      agent.config.trusted_account_key = '190'
      const badTraceStateHeader =
        /* eslint-disable-next-line max-len */
        '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827,234234@foobar'
      const valid = traceContext._validateAndParseTraceStateHeader(badTraceStateHeader)

      t.equal(supportabilitySpy.callCount, 1)
      t.equal(
        supportabilitySpy.firstCall.args[0],
        'TraceContext/TraceState/Parse/Exception/ListMember'
      )
      t.equal(valid.traceStateValid, false)
      t.end()
    })

    t.test('should fail mismatched trusted account ID in tracestate header', (t) => {
      const { agent, traceContext } = t.context
      agent.config.trusted_account_key = '190'
      const badTimestamp =
        /* eslint-disable-next-line max-len */
        '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-,234234@foo=bar'
      const valid = traceContext._validateAndParseTraceStateHeader(badTimestamp)
      t.equal(valid.entryFound, true)
      t.equal(valid.entryValid, false)
      t.end()
    })

    t.test('should handle empty priority and sampled fields (mobile payload)', (t) => {
      const { agent, traceContext } = t.context
      agent.config.trusted_account_key = '190'
      const goodTraceStateHeader =
        /* eslint-disable-next-line max-len */
        '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05---1563574856827,234234@foo=bar'
      const valid = traceContext._validateAndParseTraceStateHeader(goodTraceStateHeader)
      t.ok(valid)
      t.equal(valid.entryFound, true)
      t.equal(valid.entryValid, true)
      t.equal(valid.intrinsics.version, 0)
      t.equal(valid.intrinsics.parentType, 'App')
      t.equal(valid.intrinsics.accountId, '709288')
      t.equal(valid.intrinsics.appId, '8599547')
      t.equal(valid.intrinsics.spanId, 'f85f42fd82a4cf1d')
      t.equal(valid.intrinsics.transactionId, '164d3b4b0d09cb05')
      t.not(valid.intrinsics.sampled)
      t.not(valid.intrinsics.priority)
      t.equal(valid.intrinsics.timestamp, 1563574856827)
      t.end()
    })
  })

  t.test('header creation', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    t.test('creating traceparent twice should give the same value', function (t) {
      const { agent } = t.context
      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        const tp1 = txn.traceContext.createTraceparent()
        const tp2 = txn.traceContext.createTraceparent()

        t.equal(tp1, tp2)
        txn.end()
        t.end()
      })
    })

    t.test('should create valid headers', (t) => {
      const { agent } = t.context
      const trustedKey = '19000'
      const accountId = '190'
      const appId = '109354'
      agent.config.trusted_account_key = trustedKey
      agent.config.account_id = accountId
      agent.config.primary_application_id = appId
      agent.transactionSampler.shouldSample = () => false

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        const headers = getTraceContextHeaders(txn)
        t.ok(txn.traceContext._validateAndParseTraceParentHeader(headers.traceparent))
        t.ok(txn.traceContext._validateAndParseTraceStateHeader(headers.tracestate))
        t.equal(headers.tracestate.split('=')[0], `${trustedKey}@nr`)
        t.equal(headers.tracestate.split('-')[6], '0')
        t.equal(headers.tracestate.split('-')[3], appId)
        t.equal(headers.tracestate.split('-')[2], accountId)

        txn.end()
        t.end()
      })
    })

    t.test('should accept first valid nr entry when duplicate entries exist', (t) => {
      const { agent } = t.context
      const acctKey = '190'
      agent.config.trusted_account_key = acctKey
      const duplicateAcctTraceState =
        /* eslint-disable-next-line max-len */
        '42@bar=foo,190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827,190@nr=bar'
      const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
      const appId = '109354'

      agent.config.trusted_account_key = acctKey
      agent.config.account_id = acctKey
      agent.config.primary_application_id = appId
      agent.transactionSampler.shouldSample = () => false

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.traceContext.acceptTraceContextPayload(traceparent, duplicateAcctTraceState)
        const valid = txn.traceContext._validateAndParseTraceStateHeader(duplicateAcctTraceState)
        const traceContextPayload = getTraceContextHeaders(txn)

        t.equal(valid.entryFound, true)
        t.equal(valid.entryValid, true)
        t.notOk(valid.vendors.includes(`${acctKey}@nr`))
        const nrMatch = traceContextPayload.tracestate.match(/190@nr/g) || []
        t.equal(nrMatch.length, 1, 'has only one nr entry')

        const nonNrMatch = traceContextPayload.tracestate.match(/42@bar/g) || []
        t.equal(nonNrMatch.length, 1, 'contains non-nr entry')

        txn.end()
        t.end()
      })
    })

    t.test('should not accept first nr entry when duplicate entries exist and its invalid', (t) => {
      const { agent, traceContext } = t.context
      const acctKey = '190'
      agent.config.trusted_account_key = acctKey
      const duplicateAcctTraceState =
        /* eslint-disable-next-line max-len */
        '190@nr=bar,42@bar=foo,190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827'
      const valid = traceContext._validateAndParseTraceStateHeader(duplicateAcctTraceState)

      t.equal(valid.entryFound, true)
      t.equal(valid.entryValid, false)
      t.notOk(valid.vendors.includes(`${acctKey}@nr`))
      t.end()
    })

    t.test('should propagate headers', (t) => {
      const { agent } = t.context
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = false

      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      const tracestate = 'test=test'

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.acceptTraceContextPayload(traceparent, tracestate)

        const headers = getTraceContextHeaders(txn)

        // The parentId (current span id) of traceparent will change, but the traceId
        // should propagate
        t.ok(headers.traceparent.startsWith('00-4bf92f3577b34da6a'))

        // The test key/value should propagate at the end of the string
        t.ok(headers.tracestate.endsWith(tracestate))

        txn.end()
        t.end()
      })
    })

    t.test('should generate parentId if no span/segment in context', (t) => {
      const { agent } = t.context
      // This is a corner case and ideally never happens but is potentially possible
      // due to state loss.

      agent.config.account_id = 'AccountId1'
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

          t.equal(version, expectedVersion)
          t.equal(traceId, expectedTraceId)

          t.ok(parentId) // we should generate *something*
          t.equal(parentId.length, 16) // and it should be 16 chars

          txn.end()

          t.end()
        })
      })
    })

    t.test('should not generate spanId if no span/segment in context', (t) => {
      const { agent } = t.context
      // This is a corner case and ideally never happens but is potentially possible
      // due to state loss.

      agent.config.account_id = 'AccountId1'
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
          t.ok(tracestate.endsWith(incomingTraceState))

          const secondListMemberIndex = tracestate.indexOf(incomingTraceState)
          const nrItem = tracestate.substring(0, secondListMemberIndex)

          const splitData = nrItem.split('-')
          const { 4: spanId } = splitData

          t.equal(spanId, '')

          txn.end()

          t.end()
        })
      })
    })

    t.test('should generate new trace when receiving invalid traceparent', (t) => {
      const { agent } = t.context
      agent.config.account_id = 'AccountId1'
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

        t.equal(version, '00')
        t.ok(traceId)
        t.not(traceId, unexpectedTraceId)

        txn.end()

        t.end()
      })
    })

    t.test('should continue trace when receiving future traceparent version', (t) => {
      const { agent } = t.context
      agent.config.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedTraceId = '12345678901234567890123456789012'
      const extra = 'what-the-future-will-be-like'
      const futureTraceparent = `cc-${expectedTraceId}-1234567890123456-01-${extra}`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function (txn) {
        txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [version, traceId] = splitData

        t.equal(version, '00')
        t.equal(traceId, expectedTraceId)

        txn.end()

        t.end()
      })
    })

    t.test('should not allow extra fields for 00 traceparent version', (t) => {
      const { agent } = t.context
      agent.config.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const unexpectedTraceId = '12345678901234567890123456789012'
      const extra = 'what-the-future-will-be-like'
      const futureTraceparent = `00-${unexpectedTraceId}-1234567890123456-01-${extra}`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function (txn) {
        txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [version, traceId] = splitData

        t.equal(version, '00')
        t.not(traceId, unexpectedTraceId)

        txn.end()

        t.end()
      })
    })

    t.test('should handle combined headers with empty values', (t) => {
      const { agent } = t.context
      // The http module will automatically combine headers
      // In the case of combining ['tracestate', ''] and ['tracestate', 'foo=1']
      // An incoming header may look like tracestate: 'foo=1, '.
      agent.config.account_id = 'AccountId1'
      agent.config.primary_application_id = 'AppId1'
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

        t.equal(traceId, expectedTraceId)

        const tracestate = headers.tracestate
        const listMembers = tracestate.split(',')

        const [, fooMember] = listMembers

        t.equal(fooMember, 'foo=1')

        txn.end()

        t.end()
      })
    })

    t.test(
      'should propogate existing list members when cannot accept newrelic list members',
      (t) => {
        const { agent } = t.context
        // missing trust key means can't accept/match newrelic header
        agent.config.trusted_account_key = null
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = false

        const incomingTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
        const incomingTracestate =
          '33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-1518469636035,test=test'

        helper.runInTransaction(agent, function (txn) {
          const childSegment = txn.trace.add('child')
          childSegment.start()

          txn.acceptTraceContextPayload(incomingTraceparent, incomingTracestate)

          t.equal(supportabilitySpy.callCount, 1)

          // eslint-disable-next-line max-len
          t.equal(supportabilitySpy.firstCall.args[0], 'TraceContext/TraceState/Accept/Exception')

          const headers = getTraceContextHeaders(txn)
          // The parentId (current span id) of traceparent will change, but the traceId
          // should propagate
          t.ok(headers.traceparent.startsWith('00-4bf92f3577b34da6a'))

          // The original tracestate should be propogated
          t.equal(headers.tracestate, incomingTracestate)

          txn.end()

          t.end()
        })
      }
    )

    t.test('should propogate existing when cannot accept or generate newrelic list member', (t) => {
      const { agent } = t.context
      agent.config.trusted_account_key = null
      agent.config.account_id = null
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = false

      const incomingTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      const incomingTracestate =
        '33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-1518469636035,test=test'

      helper.runInTransaction(agent, function (txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.acceptTraceContextPayload(incomingTraceparent, incomingTracestate)

        const headers = getTraceContextHeaders(txn)
        // The parentId (current span id) of traceparent will change, but the traceId
        // should propagate
        t.ok(headers.traceparent.startsWith('00-4bf92f3577b34da6a'))

        // The original tracestate should be propogated
        t.equal(headers.tracestate, incomingTracestate)

        txn.end()

        t.end()
      })
    })

    t.test('should handle leading white space', (t) => {
      const { agent } = t.context
      agent.config.account_id = 'AccountId1'
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

        t.equal(traceId, expectedTraceId)

        txn.end()

        t.end()
      })
    })

    t.test('should handle leading tab', (t) => {
      const { agent } = t.context
      agent.config.account_id = 'AccountId1'
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

        t.equal(traceId, expectedTraceId)

        txn.end()

        t.end()
      })
    })

    t.test('should handle trailing white space', (t) => {
      const { agent } = t.context
      agent.config.account_id = 'AccountId1'
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

        t.equal(traceId, expectedTraceId)

        txn.end()

        t.end()
      })
    })

    t.test('should handle white space and tabs for a single item', (t) => {
      const { agent } = t.context
      agent.config.account_id = 'AccountId1'
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

        t.equal(traceId, expectedTraceId)

        const tracestate = headers.tracestate
        const listMembers = tracestate.split(',')

        const [, fooMember] = listMembers
        t.equal(fooMember, 'foo=1')

        txn.end()

        t.end()
      })
    })

    t.test('should handle white space and tabs between list members', (t) => {
      const { agent } = t.context
      agent.config.account_id = 'AccountId1'
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

        t.equal(traceId, expectedTraceId)

        const tracestate = headers.tracestate
        const listMembers = tracestate.split(',')

        const [, fooMember, barMember, bazMember] = listMembers

        t.equal(fooMember, 'foo=1')
        t.equal(barMember, 'bar=2')
        t.equal(bazMember, 'baz=3')

        txn.end()

        t.end()
      })
    })

    t.test('should handle trailing tab', (t) => {
      const { agent } = t.context
      agent.config.account_id = 'AccountId1'
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

        t.equal(traceId, expectedTraceId)

        txn.end()

        t.end()
      })
    })

    t.test('should handle leading and trailing white space and tabs', (t) => {
      const { agent } = t.context
      agent.config.account_id = 'AccountId1'
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

        t.equal(traceId, expectedTraceId)

        txn.end()

        t.end()
      })
    })
  })

  t.test('should gracefully handle missing required tracestate fields', (t) => {
    t.autoend()
    t.beforeEach(beforeEach)
    t.afterEach(afterEach)
    // During startup, there is a period of time where we may notice outbound
    // requests (or via API call) and attempt to create traces before receiving
    // required fields from server.

    t.test('should not create tracestate when accountId is missing', (t) => {
      const { agent } = t.context
      agent.config.account_id = null
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      helper.runInTransaction(agent, function (txn) {
        const headers = {}
        txn.traceContext.addTraceContextHeaders(headers)

        t.ok(headers.traceparent)
        t.notOk(headers.tracestate)

        t.equal(supportabilitySpy.callCount, 2)
        // eslint-disable-next-line max-len
        t.equal(supportabilitySpy.firstCall.args[0], 'TraceContext/TraceState/Create/Exception')

        txn.end()

        t.end()
      })
    })

    t.test('should not create tracestate when primary_application_id missing', (t) => {
      const { agent } = t.context
      agent.config.account_id = '12345'
      agent.config.primary_application_id = null
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      helper.runInTransaction(agent, function (txn) {
        const headers = {}
        txn.traceContext.addTraceContextHeaders(headers)

        t.ok(headers.traceparent)
        t.notOk(headers.tracestate)

        t.equal(supportabilitySpy.callCount, 2)
        // eslint-disable-next-line max-len
        t.equal(supportabilitySpy.firstCall.args[0], 'TraceContext/TraceState/Create/Exception')

        txn.end()

        t.end()
      })
    })

    t.test('should not create tracestate when trusted_account_key missing', (t) => {
      const { agent } = t.context
      agent.config.account_id = '12345'
      agent.config.primary_application_id = 'appId'
      agent.config.trusted_account_key = null
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      helper.runInTransaction(agent, function (txn) {
        const headers = {}
        txn.traceContext.addTraceContextHeaders(headers)

        t.ok(headers.traceparent)
        t.notOk(headers.tracestate)

        t.equal(supportabilitySpy.callCount, 2)
        // eslint-disable-next-line max-len
        t.equal(supportabilitySpy.firstCall.args[0], 'TraceContext/TraceState/Create/Exception')

        txn.end()

        t.end()
      })
    })
  })
})

function getTraceContextHeaders(transaction) {
  const headers = {}
  transaction.traceContext.addTraceContextHeaders(headers)
  return headers
}
