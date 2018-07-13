'use strict'

const expect = require('chai').expect
const byteUtils = require('../../../lib/util/byte-limit')

describe('byte-limit', () => {
  describe('#isValidLength', () => {
    it('verifies string is within given byte limit', () => {
      const str = '123456789'
      const isValidLength = byteUtils.isValidLength(str, 255)
      expect(isValidLength).to.be.true
    })

    it('verifies string is larger than given byte limit', () => {
      const str = '123456789'
      const isValidLength = byteUtils.isValidLength(str, 2)
      expect(isValidLength).to.be.false
    })
  })

  describe('#truncate', () => {
    it('truncates string value to given limit', () => {
      let str = '123456789'
      str = byteUtils.truncate(str, 5)
      expect(str).to.equal('12345')
    })
    it('returns original string if within limit', () => {
      let str = '123456789'
      str = byteUtils.truncate(str, 10)
      expect(str).to.equal('123456789')
    })
    it('respects multibyte characters', () => {
      let str = '\uD87E\uDC04\uD87E\uDC04'
      expect(Buffer.byteLength(str, 'utf8')).to.equal(8)
      str = byteUtils.truncate(str, 3)
      expect(str).to.equal('\uD87E')
    })
  })
})
