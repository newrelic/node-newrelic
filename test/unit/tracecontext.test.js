'use strict'

const chai = require('chai')
const expect = chai.expect
const helper = require('../lib/agent_helper')
var Transaction = require('../../lib/transaction')
const TraceContext = require('../../lib/transaction/tracecontext')
const hashes = require('../../lib/util/hashes')

describe('TraceContext', function() {
  let tc = null
  let agent = null
  let trans = null

  beforeEach(function() {
    agent = helper.loadMockedAgent({
      attributes: {enabled: true}
    })
    agent.config.feature_flag.dt_format_w3c = true
    agent.config.distributed_tracing.enabled = true
    
    trans = new Transaction(agent)
    tc = new TraceContext(trans)
  })

  afterEach(function() {
    helper.unloadAgent(agent)
  })

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

  describe.only('acceptTraceContextFromHeaders', () => {
    it('should accept a valid trace parent header', () => {
      const traceid = (hashes.makeId() + hashes.makeId()).padStart(32, '0')
      const traceparent = `00-${traceid}-00f067aa0ba902b7-00`

      const headers = {
        traceparent: traceparent
      }

      tc.acceptTraceContextFromHeaders(headers)
      expect(tc.traceId).to.equal(traceid)
    })

    it('should not accept an empty trace parent header', () => {
      const headers = {
        traceparent: null
      }

      tc.acceptTraceContextFromHeaders(headers)
      expect(tc._traceid).to.be.undefined
    })

    it('should not accept an invalid trace parent header', () => {
      const headers = {
        traceparent: 'invalid'
      }

      tc.acceptTraceContextFromHeaders(headers)
      expect(tc._traceid).to.be.undefined
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
  
  describe('_validateTraceParentHeader', () => {
    it('should pass valid traceparent header', () => {
      const traceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'
      expect(tc._validateTraceParentHeader(traceparent)).to.be.ok
    })

    it('should not pass 32 char string of all zeroes in traceid part of header', () => {
      const allZeroes = '00-00000000000000000000000000000000-00f067aa0ba902b7-00'

      expect(tc._validateTraceParentHeader(allZeroes)).to.equal(false)
    })

    it('should not pass 16 char string of all zeroes in parentid part of header', () => {
      const allZeroes = '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-00'

      expect(tc._validateTraceParentHeader(allZeroes)).to.equal(false)
    })

    it('should not pass when traceid part contains uppercase letters', () => {
      const someCaps = '00-4BF92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      expect(tc._validateTraceParentHeader(someCaps)).to.equal(false)
    })

    it('should not pass when parentid part contains uppercase letters', () => {
      const someCaps = '00-4bf92f3577b34da6a3ce929d0e0e4736-00FFFFaa0ba902b7-00'

      expect(tc._validateTraceParentHeader(someCaps)).to.equal(false)
    })

    it('should not pass when traceid part contains invalid chars', () => {
      const invalidChar = '00-ZZf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00'

      expect(tc._validateTraceParentHeader(invalidChar))
        .to.equal(false)
    })

    it('should not pass when parentid part contains invalid chars', () => {
      const invalidChar = '00-aaf92f3577b34da6a3ce929d0e0e4736-00XX67aa0ba902b7-00'

      expect(tc._validateTraceParentHeader(invalidChar))
        .to.equal(false)
    })

    it('should not pass when tracid part is < 32 char long', () => {
      const shorterStr = '00-4bf92f3-00f067aa0ba902b7-00'

      expect(tc._validateTraceParentHeader(shorterStr))
        .to.equal(false)
    })

    it('should not pass when tracid part is > 32 char long', () => {
      const longerStr = '00-4bf92f3577b34da6a3ce929d0e0e47366666666-00f067aa0ba902b7-00'

      expect(tc._validateTraceParentHeader(longerStr))
        .to.equal(false)
    })

    it('should not pass when parentid part is < 16 char long', () => {
      const shorterStr = '00-aaf92f3577b34da6a3ce929d0e0e4736-ff-00'

      expect(tc._validateTraceParentHeader(shorterStr))
        .to.equal(false)
    })

    it('should not pass when parentid part is > 16 char long', () => {
      const shorterStr = '00-aaf92f3577b34da6a3ce929d0e0e4736-00XX67aa0ba902b72322332-00'

      expect(tc._validateTraceParentHeader(shorterStr))
        .to.equal(false)
    })
  })

  describe.only('_validateTraceStateHeader', () => {
    it('should pass a valid tracestate header', () => {
      agent.config.trusted_account_key = '190'
      /* eslint-disable max-len */
      const goodTraceStateHeader  = 
      '190@nr=0-0-709288-8599547-f85f42fd82a4cf1d-164d3b4b0d09cb05-1-0.789-1563574856827,234234@foo=bar'

      expect(tc._validateTraceStateHeader(goodTraceStateHeader)).to.be.true
    })
  })
})
