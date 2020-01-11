'use strict'

const chai = require('chai')
const should = chai.should()
const expect = chai.expect
const TraceContext = require('../../lib/transaction/tracecontext')

describe.only('TraceContext', function() {
  let tc = null

  beforeEach(function() {
    tc = new TraceContext()
  })

  it('getting traceparent twice should give the same value', function() {
    raise Error('Not implemented')
  })

  describe('flags hex', function() {
    it('should parse trace flags in the traceparent header', function() {
      let flags = tc.parseFlagsHex('01')
      expect(flags.sampled).to.be.true

      flags = tc.parseFlagsHex('00')
      expect(flags.sampled).to.be.false
    })

    it('should return proper trace flags hex', function() {
      tc.flags.sampled = false
      let flagsHex = tc.createFlagsHex()
      expect(flagsHex).to.equal('00')

      tc.flags.sampled = true
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

    // TODO: add more tests around the version and flags parts of header
  })
})
