'use strict'

const expect = require('chai').expect
const byteUtils = require('../../../lib/util/byte-limit')

describe('byte-limit', () => {
  describe('#isValidLength', () => {
    it('verifies string is within given byte limit', (done) => {
      const str = '123456789'
      const isValidLength = byteUtils.isValidLength(str, 255)
      expect(isValidLength).to.be.true
      done()
    })

    it('verifies string is larger than given byte limit', (done) => {
      const str = '123456789'
      const isValidLength = byteUtils.isValidLength(str, 2)
      expect(isValidLength).to.be.false
      done()
    })
  })

  describe('#truncate', () => {
    it('truncates string value to given limit', (done) => {
      let str = '123456789'
      str = byteUtils.truncate(str, 5)
      expect(str).to.equal('12345')
      done()
    })
    it('returns original string if within limit', (done) => {
      let str = '123456789'
      str = byteUtils.truncate(str, 10)
      expect(str).to.equal('123456789')
      done()
    })
  })
})