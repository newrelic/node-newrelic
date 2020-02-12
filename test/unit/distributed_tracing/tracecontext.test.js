'use strict'

const chai = require('chai')
const expect = chai.expect
const helper = require('../../lib/agent_helper')
var Transaction = require('../../../lib/transaction')
const TraceContext = require('../../../lib/transaction/tracecontext').TraceContext
const sinon = require('sinon')

describe('TraceContext', function() {
  let traceContext = null
  let agent = null
  let transaction = null
  let supportabilitySpy = sinon.spy()

  beforeEach(function() {
    agent = helper.loadMockedAgent({
      attributes: {enabled: true}
    })

    agent.config.account_id = 'AccountId1'
    agent.config.primary_application_id = 'AppId1'
    agent.config.trusted_account_key = 33
    agent.config.distributed_tracing.enabled = true

    agent.recordSupportability = supportabilitySpy

    transaction = new Transaction(agent)
    traceContext = new TraceContext(transaction)
  })

  afterEach(function() {
    supportabilitySpy.resetHistory()
    helper.unloadAgent(agent)
  })

  describe('acceptTraceContextPayload', () => {
    it('should accept valid trace context headers', () => {
      const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
      // eslint-disable-next-line max-len
      const tracestate = `33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-${Date.now()}`

      const tcd = traceContext.acceptTraceContextPayload(traceparent, tracestate)
      expect(tcd.acceptedTraceparent).to.equal(true)
      expect(tcd.acceptedTracestate).to.equal(true)
      expect(tcd.traceId).to.equal('00015f9f95352ad550284c27c5d3084c')
      expect(tcd.parentSpanId).to.equal('00f067aa0ba902b7')
      expect(tcd.parentType).to.equal('App')
      expect(tcd.accountId).to.equal('33')
      expect(tcd.appId).to.equal('2827902')
      expect(tcd.transactionId).to.equal('e8b91a159289ff74')
      expect(tcd.sampled).to.equal(true)
      expect(tcd.priority).to.equal(1.23456)
      expect(tcd.transportDuration).to.be.below(10)
      expect(tcd.transportDuration).to.be.at.least(0)
    })

    it('should not accept an empty traceparent header', () => {
      const tcd = traceContext.acceptTraceContextPayload(null, '')
      expect(tcd.acceptedTraceparent).to.equal(false)
    })

    it('should not accept an invalid traceparent header', () => {
      const tcd = traceContext.acceptTraceContextPayload('invalid', '')
      expect(tcd.acceptedTraceparent).to.equal(false)
    })

    it('should not accept an invalid tracestate header', () => {
      const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
      const tracestate = 'asdf,===asdf,,'
      const tcd = traceContext.acceptTraceContextPayload(traceparent, tracestate)

      expect(supportabilitySpy.callCount).to.equal(1)
      /* eslint-disable-next-line max-len */
      expect(supportabilitySpy.firstCall.args[0]).to.equal('TraceContext/TraceState/Parse/Exception')

      expect(tcd.acceptedTraceparent).to.equal(true)
      expect(tcd.acceptedTracestate).to.equal(false)
    })

    it('should accept traceparent when tracestate missing', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = false

      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      helper.runInTransaction(agent, function(txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.acceptTraceContextPayload(traceparent, undefined)

        // The traceId should propagate
        const newTraceparent = txn.traceContext.createTraceparent()
        expect(newTraceparent.startsWith('00-4bf92f3577b34da6a')).to.be.true

        txn.end()
      })
    })

    it('should accept traceparent when tracestate empty string', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = false

      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      const tracestate = ''

      helper.runInTransaction(agent, function(txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.acceptTraceContextPayload(traceparent, tracestate)

        // The traceId should propagate
        const newTraceparent = txn.traceContext.createTraceparent()
        expect(newTraceparent.startsWith('00-4bf92f3577b34da6a')).to.be.true

        txn.end()
      })
    })
  })

  describe('flags hex', function() {
    it('should parse trace flags in the traceparent header', function() {
      let flags = traceContext.parseFlagsHex('01')
      expect(flags.sampled).to.be.true

      flags = traceContext.parseFlagsHex('00')
      expect(flags.sampled).to.be.false
    })

    it('should return proper trace flags hex', function() {
      transaction.sampled = false
      let flagsHex = traceContext.createFlagsHex()
      expect(flagsHex).to.equal('00')

      transaction.sampled = true
      flagsHex = traceContext.createFlagsHex()
      expect(flagsHex).to.equal('01')
    })
  })

  describe('_validateAndParseTraceParentHeader', () => {
    it('should pass valid traceparent header', () => {
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      expect(traceContext._validateAndParseTraceParentHeader(traceparent).entryValid).to.be.ok
    })

    it('should not pass 32 char string of all zeroes in traceid part of header', () => {
      const allZeroes = '00-00000000000000000000000000000000-00f067aa0ba902b7-00'

      expect(traceContext._validateAndParseTraceParentHeader(allZeroes).entryValid).to.equal(false)
    })

    it('should not pass 16 char string of all zeroes in parentid part of header', () => {
      const allZeroes = '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-00'

      expect(traceContext._validateAndParseTraceParentHeader(allZeroes).entryValid).to.equal(false)
    })

    it('should not pass when traceid part contains uppercase letters', () => {
      const someCaps = '00-4BF92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      expect(traceContext._validateAndParseTraceParentHeader(someCaps).entryValid).to.equal(false)
    })

    it('should not pass when parentid part contains uppercase letters', () => {
      const someCaps = '00-4bf92f3577b34da6a3ce929d0e0e4736-00FFFFaa0ba902b7-00'

      expect(traceContext._validateAndParseTraceParentHeader(someCaps).entryValid).to.equal(false)
    })

    it('should not pass when traceid part contains invalid chars', () => {
      const invalidChar = '00-ZZf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      expect(traceContext._validateAndParseTraceParentHeader(invalidChar).entryValid)
        .to.equal(false)
    })

    it('should not pass when parentid part contains invalid chars', () => {
      const invalidChar = '00-aaf92f3577b34da6a3ce929d0e0e4736-00XX67aa0ba902b7-00'

      expect(traceContext._validateAndParseTraceParentHeader(invalidChar).entryValid)
        .to.equal(false)
    })

    it('should not pass when tracid part is < 32 char long', () => {
      const shorterStr = '00-4bf92f3-00f067aa0ba902b7-00'

      expect(traceContext._validateAndParseTraceParentHeader(shorterStr).entryValid)
        .to.equal(false)
    })

    it('should not pass when tracid part is > 32 char long', () => {
      const longerStr = '00-4bf92f3577b34da6a3ce929d0e0e47366666666-00f067aa0ba902b7-00'

      expect(traceContext._validateAndParseTraceParentHeader(longerStr).entryValid)
        .to.equal(false)
    })

    it('should not pass when parentid part is < 16 char long', () => {
      const shorterStr = '00-aaf92f3577b34da6a3ce929d0e0e4736-ff-00'

      expect(traceContext._validateAndParseTraceParentHeader(shorterStr).entryValid)
        .to.equal(false)
    })

    it('should not pass when parentid part is > 16 char long', () => {
      const shorterStr = '00-aaf92f3577b34da6a3ce929d0e0e4736-00XX67aa0ba902b72322332-00'

      expect(traceContext._validateAndParseTraceParentHeader(shorterStr).entryValid)
        .to.equal(false)
    })
  })

  describe('_validateAndParseTraceStateHeader', () => {
    it('should pass a valid tracestate header', () => {
      agent.config.trusted_account_key = '190'
      const goodTraceStateHeader =
      /* eslint-disable-next-line max-len */
      '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827,234234@foo=bar'
      const valid = traceContext._validateAndParseTraceStateHeader(goodTraceStateHeader)
      expect(valid).to.be.ok
      expect(valid.entryFound).to.be.true
      expect(valid.entryValid).to.be.true
      expect(valid.intrinsics.version).to.equal(0)
      expect(valid.intrinsics.parentType).to.equal('App')
      expect(valid.intrinsics.accountId).to.equal('709288')
      expect(valid.intrinsics.appId).to.equal('8599547')
      expect(valid.intrinsics.spanId).to.equal('f85f42fd82a4cf1d')
      expect(valid.intrinsics.transactionId).to.equal('164d3b4b0d09cb05')
      expect(valid.intrinsics.sampled).to.equal(true)
      expect(valid.intrinsics.priority).to.equal(0.789)
      expect(valid.intrinsics.timestamp).to.equal(1563574856827)
    })

    it('should fail mismatched trusted account ID in tracestate header', () => {
      agent.config.trusted_account_key = '666'
      const badTraceStateHeader =
        /* eslint-disable-next-line max-len */
        '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827,234234@foo=bar'
      const valid = traceContext._validateAndParseTraceStateHeader(badTraceStateHeader)

      expect(supportabilitySpy.callCount).to.equal(1)
      expect(supportabilitySpy.firstCall.args[0]).to.equal('TraceContext/TraceState/NoNrEntry')
      expect(valid.entryFound).to.be.false
      expect(valid.entryValid).to.be.undefined
    })

    it('should fail mismatched trusted account ID in tracestate header', () => {
      agent.config.trusted_account_key = '190'
      const badTimestamp =
        /* eslint-disable-next-line max-len */
        '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-,234234@foo=bar'
      const valid = traceContext._validateAndParseTraceStateHeader(badTimestamp)
      expect(valid.entryFound).to.be.true
      expect(valid.entryValid).to.be.false
    })

    it('should handle empty priority and sampled fields (mobile payload)', () => {
      agent.config.trusted_account_key = '190'
      const goodTraceStateHeader =
      /* eslint-disable-next-line max-len */
      '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05---1563574856827,234234@foo=bar'
      const valid = traceContext._validateAndParseTraceStateHeader(goodTraceStateHeader)
      expect(valid).to.be.ok
      expect(valid.entryFound).to.be.true
      expect(valid.entryValid).to.be.true
      expect(valid.intrinsics.version).to.equal(0)
      expect(valid.intrinsics.parentType).to.equal('App')
      expect(valid.intrinsics.accountId).to.equal('709288')
      expect(valid.intrinsics.appId).to.equal('8599547')
      expect(valid.intrinsics.spanId).to.equal('f85f42fd82a4cf1d')
      expect(valid.intrinsics.transactionId).to.equal('164d3b4b0d09cb05')
      expect(valid.intrinsics.sampled).to.not.exist
      expect(valid.intrinsics.priority).to.not.exist
      expect(valid.intrinsics.timestamp).to.equal(1563574856827)
    })
  })

  describe('header creation', () => {
    it('creating traceparent twice should give the same value', function() {
      helper.runInTransaction(agent, function(txn) {
        var childSegment = txn.trace.add('child')
        childSegment.start()

        const tp1 = txn.traceContext.createTraceparent()
        const tp2 = txn.traceContext.createTraceparent()

        expect(tp1).to.equal(tp2)
        txn.end()
      })
    })

    it('should create valid headers', () => {
      const trusted_key = '19000'
      const accountId = '190'
      const appId = '109354'
      agent.config.trusted_account_key = trusted_key
      agent.config.account_id = accountId
      agent.config.primary_application_id = appId
      agent.transactionSampler.shouldSample = () => false

      helper.runInTransaction(agent, function(txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        const headers = getTraceContextHeaders(txn)
        expect(txn.traceContext._validateAndParseTraceParentHeader(headers.traceparent)).to.be.ok
        expect(txn.traceContext._validateAndParseTraceStateHeader(headers.tracestate)).to.be.ok
        expect(headers.tracestate.split('=')[0]).to.equal(`${trusted_key}@nr`)
        expect(headers.tracestate.split('-')[6]).to.equal('0')
        expect(headers.tracestate.split('-')[3]).to.equal(appId)
        expect(headers.tracestate.split('-')[2]).to.equal(accountId)

        txn.end()
      })
    })

    it('should accept first valid nr entry when duplicate entries exist', () => {
      const acct_key = '190'
      agent.config.trusted_account_key = acct_key
      const duplicateAcctTraceState =
        /* eslint-disable-next-line max-len */
        '42@bar=foo,190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827,190@nr=bar'
      const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
      const appId = '109354'

      agent.config.trusted_account_key = acct_key
      agent.config.account_id = acct_key
      agent.config.primary_application_id = appId
      agent.transactionSampler.shouldSample = () => false

      helper.runInTransaction(agent, function(txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.traceContext.acceptTraceContextPayload(traceparent, duplicateAcctTraceState)
        const valid = txn.traceContext._validateAndParseTraceStateHeader(duplicateAcctTraceState)
        const traceContextPayload = getTraceContextHeaders(txn)

        expect(valid.entryFound).to.be.true
        expect(valid.entryValid).to.be.true
        expect(valid.vendors.match(`${acct_key}@nr`)).to.not.exist

        const nrMatch = (traceContextPayload.tracestate.match(/190@nr/g) || [])
        expect(nrMatch.length, 'has only one nr entry').to.equal(1)

        const nonNrMatch = (traceContextPayload.tracestate.match(/42@bar/g) || [])
        expect(nonNrMatch.length, 'contains non-nr entry').to.equal(1)

        txn.end()
      })
    })

    it('should not accept first nr entry when duplicate entries exist and its invalid', () => {
      const acct_key = '190'
      agent.config.trusted_account_key = acct_key
      const duplicateAcctTraceState =
        /* eslint-disable-next-line max-len */
        '190@nr=bar,42@bar=foo,190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827'
      const valid = traceContext._validateAndParseTraceStateHeader(duplicateAcctTraceState)

      expect(valid.entryFound).to.be.true
      expect(valid.entryValid).to.be.false
      expect(valid.vendors.match(`${acct_key}@nr`)).to.not.exist
    })

    it('should propogate headers', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = false

      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      const tracestate = 'test=test'

      helper.runInTransaction(agent, function(txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.acceptTraceContextPayload(traceparent, tracestate)

        const headers = getTraceContextHeaders(txn)

        // The parentId (current span id) of traceparent will change, but the traceId
        // should propagate
        expect(headers.traceparent.startsWith('00-4bf92f3577b34da6a')).to.be.true

        // The test key/value should propagate at the end of the string
        expect(headers.tracestate.endsWith(tracestate)).to.be.true

        txn.end()
      })
    })

    it('should generate parentId if no span/segment in context', (done) => {
      // This is a corner case and ideally never happens but is potentially possible
      // due to state loss.

      agent.config.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedVersion = '00'
      const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
      const traceparent = `${expectedVersion}-${expectedTraceId}-00f067aa0ba902b7-00`
      const tracestate = 'test=test'

      helper.runInTransaction(agent, function(txn) {
        helper.runOutOfContext(() => {
          txn.acceptTraceContextPayload(traceparent, tracestate)

          const headers = getTraceContextHeaders(txn)

          const splitData = headers.traceparent.split('-')
          const [version, traceId, parentId] = splitData

          expect(version).to.equal(expectedVersion)
          expect(traceId).to.equal(expectedTraceId)

          expect(parentId).to.exist // we should generate *something*
          expect(parentId.length).to.equal(16) // and it should be 16 chars

          txn.end()

          done()
        })
      })
    })

    it('should not generate spanId if no span/segment in context', (done) => {
      // This is a corner case and ideally never happens but is potentially possible
      // due to state loss.

      agent.config.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedVersion = '00'
      const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
      const traceparent = `${expectedVersion}-${expectedTraceId}-00f067aa0ba902b7-00`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function(txn) {
        helper.runOutOfContext(() => {
          txn.acceptTraceContextPayload(traceparent, incomingTraceState)

          const outboundHeaders = getTraceContextHeaders(txn)
          const tracestate = outboundHeaders.tracestate

          // The test key/value should propagate at the end of the string
          expect(tracestate.endsWith(incomingTraceState)).to.be.true

          const secondListMemberIndex = tracestate.indexOf(incomingTraceState)
          const nrItem = tracestate.substring(0, secondListMemberIndex)

          const splitData = nrItem.split('-')
          const {4: spanId} = splitData

          expect(spanId).to.equal('')

          txn.end()

          done()
        })
      })
    })

    it('should generate new trace when receiving invalid traceparent', (done) => {
      agent.config.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const unexpectedTraceId = '12345678901234567890123456789012'
      // version 255 (ff) is forbidden...
      const traceparent = `ff-${unexpectedTraceId}-1234567890123456-01`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function(txn) {
        txn.acceptTraceContextPayload(traceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [version, traceId] = splitData

        expect(version).to.equal('00')
        expect(traceId).to.exist
        expect(traceId).to.not.equal(unexpectedTraceId)

        txn.end()

        done()
      })
    })

    it('should continue trace when receiving future traceparent version', (done) => {
      agent.config.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const expectedTraceId = '12345678901234567890123456789012'
      const extra = 'what-the-future-will-be-like'
      const futureTraceparent = `cc-${expectedTraceId}-1234567890123456-01-${extra}`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function(txn) {
        txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [version, traceId] = splitData

        expect(version).to.equal('00')
        expect(traceId).to.equal(expectedTraceId)

        txn.end()

        done()
      })
    })

    it('should not allow extra fields for 00 traceparent version', (done) => {
      agent.config.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true

      const unexpectedTraceId = '12345678901234567890123456789012'
      const extra = 'what-the-future-will-be-like'
      const futureTraceparent = `00-${unexpectedTraceId}-1234567890123456-01-${extra}`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function(txn) {
        txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [version, traceId] = splitData

        expect(version).to.equal('00')
        expect(traceId).to.not.equal(unexpectedTraceId)

        txn.end()

        done()
      })
    })

    it('should handle combined headers with empty values', (done) => {
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

      helper.runInTransaction(agent, function(txn) {
        txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

        const headers = getTraceContextHeaders(txn)
        const splitData = headers.traceparent.split('-')
        const [, traceId] = splitData

        expect(traceId).to.equal(expectedTraceId)

        const tracestate = headers.tracestate
        const listMembers = tracestate.split(',')

        const [,fooMember] = listMembers

        expect(fooMember).to.equal('foo=1')

        txn.end()

        done()
      })
    })

    it(
      'should propogate existing list members when cannot accept newrelic list members',
      (done) => {
        // missing trust key means can't accept/match newrelic header
        agent.config.trusted_account_key = null
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = false

        const incomingTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
        const incomingTracestate =
          '33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-1518469636035,test=test'

        helper.runInTransaction(agent, function(txn) {
          const childSegment = txn.trace.add('child')
          childSegment.start()

          txn.acceptTraceContextPayload(incomingTraceparent, incomingTracestate)

          expect(supportabilitySpy.callCount).to.equal(1)

          // eslint-disable-next-line max-len
          expect(supportabilitySpy.firstCall.args[0]).to.equal('TraceContext/TraceState/Accept/Exception')

          const headers = getTraceContextHeaders(txn)
          // The parentId (current span id) of traceparent will change, but the traceId
          // should propagate
          expect(headers.traceparent.startsWith('00-4bf92f3577b34da6a')).to.be.true

          // The original tracestate should be propogated
          expect(headers.tracestate).to.equal(incomingTracestate)

          txn.end()

          done()
        })
      }
    )

    it(
      'should propogate existing when cannot accept or generate newrelic list member',
      (done) => {
        agent.config.trusted_account_key = null
        agent.config.account_id = null
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = false

        const incomingTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
        const incomingTracestate =
          '33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-1518469636035,test=test'

        helper.runInTransaction(agent, function(txn) {
          const childSegment = txn.trace.add('child')
          childSegment.start()

          txn.acceptTraceContextPayload(incomingTraceparent, incomingTracestate)

          const headers = getTraceContextHeaders(txn)
          // The parentId (current span id) of traceparent will change, but the traceId
          // should propagate
          expect(headers.traceparent.startsWith('00-4bf92f3577b34da6a')).to.be.true

          // The original tracestate should be propogated
          expect(headers.tracestate).to.equal(incomingTracestate)

          txn.end()

          done()
        })
      }
    )

    describe('traceparent parsing should accept and remove optional white space (OWS)', () => {
      it('should handle leading white space', (done) => {
        agent.config.account_id = 'AccountId1'
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = true

        const expectedTraceId = '12345678901234567890123456789012'
        const futureTraceparent = ` 00-${expectedTraceId}-1234567890123456-01`
        const incomingTraceState = 'test=test'

        helper.runInTransaction(agent, function(txn) {
          txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

          const headers = getTraceContextHeaders(txn)
          const splitData = headers.traceparent.split('-')
          const [, traceId] = splitData

          expect(traceId).to.equal(expectedTraceId)

          txn.end()

          done()
        })
      })

      it('should handle leading tab', (done) => {
        agent.config.account_id = 'AccountId1'
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = true

        const expectedTraceId = '12345678901234567890123456789012'
        const futureTraceparent = `\t00-${expectedTraceId}-1234567890123456-01`
        const incomingTraceState = 'test=test'

        helper.runInTransaction(agent, function(txn) {
          txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

          const headers = getTraceContextHeaders(txn)
          const splitData = headers.traceparent.split('-')
          const [, traceId] = splitData

          expect(traceId).to.equal(expectedTraceId)

          txn.end()

          done()
        })
      })

      it('should handle trailing white space', (done) => {
        agent.config.account_id = 'AccountId1'
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = true


        const expectedTraceId = '12345678901234567890123456789012'
        const futureTraceparent = `00-${expectedTraceId}-1234567890123456-01 `
        const incomingTraceState = 'test=test'

        helper.runInTransaction(agent, function(txn) {
          txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

          const headers = getTraceContextHeaders(txn)
          const splitData = headers.traceparent.split('-')
          const [, traceId] = splitData

          expect(traceId).to.equal(expectedTraceId)

          txn.end()

          done()
        })
      })
    })

    describe('tracestate parsing should accept and remove optional white space (OWS)', () => {
      it('should handle white space and tabs for a single item', (done) => {
        agent.config.account_id = 'AccountId1'
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = true

        const expectedTraceId = '12345678901234567890123456789012'
        const futureTraceparent = `00-${expectedTraceId}-1234567890123456-01`
        const incomingTraceState = '\t foo=1 \t'

        helper.runInTransaction(agent, function(txn) {
          txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

          const headers = getTraceContextHeaders(txn)
          const splitData = headers.traceparent.split('-')
          const [, traceId] = splitData

          expect(traceId).to.equal(expectedTraceId)

          const tracestate = headers.tracestate
          const listMembers = tracestate.split(',')

          const [,fooMember] = listMembers
          expect(fooMember).to.equal('foo=1')

          txn.end()

          done()
        })
      })

      it('should handle white space and tabs between list members', (done) => {
        agent.config.account_id = 'AccountId1'
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = true

        const expectedTraceId = '12345678901234567890123456789012'
        const futureTraceparent = `00-${expectedTraceId}-1234567890123456-01`
        const incomingTraceState = 'foo=1 \t , \t bar=2, \t baz=3'

        helper.runInTransaction(agent, function(txn) {
          txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

          const headers = getTraceContextHeaders(txn)
          const splitData = headers.traceparent.split('-')
          const [, traceId] = splitData

          expect(traceId).to.equal(expectedTraceId)

          const tracestate = headers.tracestate
          const listMembers = tracestate.split(',')

          const [,fooMember, barMember, bazMember] = listMembers

          expect(fooMember).to.equal('foo=1')
          expect(barMember).to.equal('bar=2')
          expect(bazMember).to.equal('baz=3')

          txn.end()

          done()
        })
      })

      it('should handle trailing tab', (done) => {
        agent.config.account_id = 'AccountId1'
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = true

        const expectedTraceId = '12345678901234567890123456789012'
        const futureTraceparent = `00-${expectedTraceId}-1234567890123456-01\t`
        const incomingTraceState = 'test=test'

        helper.runInTransaction(agent, function(txn) {
          txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

          const headers = getTraceContextHeaders(txn)
          const splitData = headers.traceparent.split('-')
          const [, traceId] = splitData

          expect(traceId).to.equal(expectedTraceId)

          txn.end()

          done()
        })
      })

      it('should handle leading and trailing white space and tabs', (done) => {
        agent.config.account_id = 'AccountId1'
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = true

        const expectedTraceId = '12345678901234567890123456789012'
        const futureTraceparent = `\t 00-${expectedTraceId}-1234567890123456-01 \t`
        const incomingTraceState = 'test=test'

        helper.runInTransaction(agent, function(txn) {
          txn.acceptTraceContextPayload(futureTraceparent, incomingTraceState)

          const headers = getTraceContextHeaders(txn)
          const splitData = headers.traceparent.split('-')
          const [, traceId] = splitData

          expect(traceId).to.equal(expectedTraceId)

          txn.end()

          done()
        })
      })
    })

    describe('should gracefully handle missing required tracestate fields', () => {
      // During startup, there is a period of time where we may notice outbound
      // requests (or via API call) and attempt to create traces before receiving
      // required fields from server.

      it('should not create tracestate when accountId is missing', (done) => {
        agent.config.account_id = null
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = true

        helper.runInTransaction(agent, function(txn) {
          const headers = {}
          txn.traceContext.addTraceContextHeaders(headers)

          expect(headers).to.have.property('traceparent')
          expect(headers).to.not.have.property('tracestate')

          expect(supportabilitySpy.callCount).to.equal(2)
          // eslint-disable-next-line max-len
          expect(supportabilitySpy.firstCall.args[0]).to.equal('TraceContext/TraceState/Create/Exception')

          txn.end()

          done()
        })
      })

      it('should not create tracestate when primary_application_id missing', (done) => {
        agent.config.account_id = '12345'
        agent.config.primary_application_id = null
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = true

        helper.runInTransaction(agent, function(txn) {
          const headers = {}
          txn.traceContext.addTraceContextHeaders(headers)

          expect(headers).to.have.property('traceparent')
          expect(headers).to.not.have.property('tracestate')

          expect(supportabilitySpy.callCount).to.equal(2)
          // eslint-disable-next-line max-len
          expect(supportabilitySpy.firstCall.args[0]).to.equal('TraceContext/TraceState/Create/Exception')

          txn.end()

          done()
        })
      })

      it('should not create tracestate when trusted_account_key missing', (done) => {
        agent.config.account_id = '12345'
        agent.config.primary_application_id = 'appId'
        agent.config.trusted_account_key = null
        agent.config.distributed_tracing.enabled = true
        agent.config.span_events.enabled = true

        helper.runInTransaction(agent, function(txn) {
          const headers = {}
          txn.traceContext.addTraceContextHeaders(headers)

          expect(headers).to.have.property('traceparent')
          expect(headers).to.not.have.property('tracestate')

          expect(supportabilitySpy.callCount).to.equal(2)
          // eslint-disable-next-line max-len
          expect(supportabilitySpy.firstCall.args[0]).to.equal('TraceContext/TraceState/Create/Exception')

          txn.end()

          done()
        })
      })
    })
  })
})

function getTraceContextHeaders(transaction) {
  const headers = {}
  transaction.traceContext.addTraceContextHeaders(headers)
  return headers
}
