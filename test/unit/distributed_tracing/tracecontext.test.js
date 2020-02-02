'use strict'

const chai = require('chai')
const expect = chai.expect
const helper = require('../../lib/agent_helper')
var Transaction = require('../../../lib/transaction')
const TraceContext = require('../../../lib/transaction/tracecontext').TraceContext

describe('TraceContext', function() {
  let tc = null
  let agent = null
  let trans = null

  beforeEach(function() {
    agent = helper.loadMockedAgent({
      attributes: {enabled: true}
    })
    agent.config.trusted_account_key = 33
    agent.config.feature_flag.dt_format_w3c = true
    agent.config.distributed_tracing.enabled = true

    trans = new Transaction(agent)
    tc = new TraceContext(trans)
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

  describe('acceptTraceContextPayload', () => {
    it('should accept valid trace context headers', () => {
      const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
      // eslint-disable-next-line max-len
      const tracestate = `33@nr=0-0-33-2827902-7d3efb1b173fecfa-e8b91a159289ff74-1-1.23456-${Date.now()}`

      const tcd = tc.acceptTraceContextPayload(traceparent, tracestate)
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
      const tcd = tc.acceptTraceContextPayload(null, '')
      expect(tcd.acceptedTraceparent).to.equal(false)
    })

    it('should not accept an invalid traceparent header', () => {
      const tcd = tc.acceptTraceContextPayload('invalid', '')
      expect(tcd.acceptedTraceparent).to.equal(false)
    })

    it('should not accept an invalid tracestate header', () => {
      const traceparent = '00-00015f9f95352ad550284c27c5d3084c-00f067aa0ba902b7-00'
      const tracestate = 'asdf,===asdf,,'
      const tcd = tc.acceptTraceContextPayload(traceparent, tracestate)
      expect(tcd.acceptedTraceparent).to.equal(true)
      expect(tcd.acceptedTracestate).to.equal(false)
    })
  })

  describe('flags hex', function() {
    it('should parse trace flags in the traceparent header', function() {
      let flags = tc.parseFlagsHex('01')
      expect(flags.sampled).to.be.true

      flags = tc.parseFlagsHex('00')
      expect(flags.sampled).to.be.false
    })

    it('should return proper trace flags hex', function() {
      trans.sampled = false
      let flagsHex = tc.createFlagsHex()
      expect(flagsHex).to.equal('00')

      trans.sampled = true
      flagsHex = tc.createFlagsHex()
      expect(flagsHex).to.equal('01')
    })
  })

  describe('_validateAndParseTraceParentHeader', () => {
    it('should pass valid traceparent header', () => {
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      expect(tc._validateAndParseTraceParentHeader(traceparent).entryValid).to.be.ok
    })

    it('should not pass 32 char string of all zeroes in traceid part of header', () => {
      const allZeroes = '00-00000000000000000000000000000000-00f067aa0ba902b7-00'

      expect(tc._validateAndParseTraceParentHeader(allZeroes).entryValid).to.equal(false)
    })

    it('should not pass 16 char string of all zeroes in parentid part of header', () => {
      const allZeroes = '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-00'

      expect(tc._validateAndParseTraceParentHeader(allZeroes).entryValid).to.equal(false)
    })

    it('should not pass when traceid part contains uppercase letters', () => {
      const someCaps = '00-4BF92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      expect(tc._validateAndParseTraceParentHeader(someCaps).entryValid).to.equal(false)
    })

    it('should not pass when parentid part contains uppercase letters', () => {
      const someCaps = '00-4bf92f3577b34da6a3ce929d0e0e4736-00FFFFaa0ba902b7-00'

      expect(tc._validateAndParseTraceParentHeader(someCaps).entryValid).to.equal(false)
    })

    it('should not pass when traceid part contains invalid chars', () => {
      const invalidChar = '00-ZZf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      expect(tc._validateAndParseTraceParentHeader(invalidChar).entryValid)
        .to.equal(false)
    })

    it('should not pass when parentid part contains invalid chars', () => {
      const invalidChar = '00-aaf92f3577b34da6a3ce929d0e0e4736-00XX67aa0ba902b7-00'

      expect(tc._validateAndParseTraceParentHeader(invalidChar).entryValid)
        .to.equal(false)
    })

    it('should not pass when tracid part is < 32 char long', () => {
      const shorterStr = '00-4bf92f3-00f067aa0ba902b7-00'

      expect(tc._validateAndParseTraceParentHeader(shorterStr).entryValid)
        .to.equal(false)
    })

    it('should not pass when tracid part is > 32 char long', () => {
      const longerStr = '00-4bf92f3577b34da6a3ce929d0e0e47366666666-00f067aa0ba902b7-00'

      expect(tc._validateAndParseTraceParentHeader(longerStr).entryValid)
        .to.equal(false)
    })

    it('should not pass when parentid part is < 16 char long', () => {
      const shorterStr = '00-aaf92f3577b34da6a3ce929d0e0e4736-ff-00'

      expect(tc._validateAndParseTraceParentHeader(shorterStr).entryValid)
        .to.equal(false)
    })

    it('should not pass when parentid part is > 16 char long', () => {
      const shorterStr = '00-aaf92f3577b34da6a3ce929d0e0e4736-00XX67aa0ba902b72322332-00'

      expect(tc._validateAndParseTraceParentHeader(shorterStr).entryValid)
        .to.equal(false)
    })
  })

  describe('_validateAndParseTraceStateHeader', () => {
    it('should pass a valid tracestate header', () => {
      agent.config.trusted_account_key = '190'
      const goodTraceStateHeader =
      /* eslint-disable-next-line max-len */
      '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827,234234@foo=bar'
      const valid = tc._validateAndParseTraceStateHeader(goodTraceStateHeader)
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
      const valid = tc._validateAndParseTraceStateHeader(badTraceStateHeader)
      expect(valid.entryFound).to.be.false
      expect(valid.entryValid).to.be.undefined
    })

    it('should fail mismatched trusted account ID in tracestate header', () => {
      agent.config.trusted_account_key = '190'
      const badTimestamp =
        /* eslint-disable-next-line max-len */
        '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-,234234@foo=bar'
      const valid = tc._validateAndParseTraceStateHeader(badTimestamp)
      expect(valid.entryFound).to.be.true
      expect(valid.entryValid).to.be.false
    })
  })

  describe('header creation', () => {
    it('getting traceparent twice should give the same value', function() {
      helper.runInTransaction(agent, function(txn) {
        var childSegment = txn.trace.add('child')
        childSegment.start()

        const tp1 = txn.traceContext.traceparent
        const tp2 = txn.traceContext.traceparent

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

        const headers = txn.traceContext.createTraceContextPayload()
        expect(txn.traceContext._validateAndParseTraceParentHeader(headers.traceparent)).to.be.ok
        expect(txn.traceContext._validateAndParseTraceStateHeader(headers.tracestate)).to.be.ok
        expect(headers.tracestate.split('=')[0]).to.equal(`${trusted_key}@nr`)
        expect(headers.tracestate.split('-')[6]).to.equal('0')
        expect(headers.tracestate.split('-')[3]).to.equal(appId)
        expect(headers.tracestate.split('-')[2]).to.equal(accountId)

        txn.end()
      })
    })

    it('should propogate headers', () => {
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = false
      agent.config.feature_flag.dt_format_w3c = true
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      const tracestate = 'test=test'

      helper.runInTransaction(agent, function(txn) {
        const childSegment = txn.trace.add('child')
        childSegment.start()

        txn.acceptTraceContextPayload(traceparent, tracestate)

        // The parentId (current span id) of traceparent will change, but the traceId
        // should propagate
        expect(txn.traceContext.traceparent.startsWith('00-4bf92f3577b34da6a')).to.be.true

        // The test key/value should propagate at the end of the string
        expect(txn.traceContext.tracestate.endsWith(tracestate)).to.be.true

        txn.end()
      })
    })

    it('should generate parentId if no span/segment in context', (done) => {
      // This is a corner case and ideally never happens but is potentially possible
      // due to state loss.

      agent.config.account_id = 'AccountId1'
      agent.config.distributed_tracing.enabled = true
      agent.config.span_events.enabled = true
      agent.config.feature_flag.dt_format_w3c = true

      const expectedVersion = '00'
      const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
      const traceparent = `${expectedVersion}-${expectedTraceId}-00f067aa0ba902b7-00`
      const tracestate = 'test=test'

      helper.runInTransaction(agent, function(txn) {
        helper.runOutOfContext(() => {
          txn.acceptTraceContextPayload(traceparent, tracestate)

          const splitData = txn.traceContext.traceparent.split('-')
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
      agent.config.feature_flag.dt_format_w3c = true

      const expectedVersion = '00'
      const expectedTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
      const traceparent = `${expectedVersion}-${expectedTraceId}-00f067aa0ba902b7-00`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function(txn) {
        helper.runOutOfContext(() => {
          txn.acceptTraceContextPayload(traceparent, incomingTraceState)

          const tracestate = txn.traceContext.tracestate

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
      agent.config.feature_flag.dt_format_w3c = true

      const unexpectedTraceId = '12345678901234567890123456789012'
      // version 255 (ff) is forbidden...
      const traceparent = `ff-${unexpectedTraceId}-1234567890123456-01`
      const incomingTraceState = 'test=test'

      helper.runInTransaction(agent, function(txn) {
        txn.acceptTraceContextPayload(traceparent, incomingTraceState)

        const splitData = txn.traceContext.traceparent.split('-')
        const [version, traceId] = splitData

        expect(version).to.equal('00')
        expect(traceId).to.exist
        expect(traceId).to.not.equal(unexpectedTraceId)

        txn.end()

        done()
      })
    })
  })
})
