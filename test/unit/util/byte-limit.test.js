'use strict'

const expect = require('chai').expect
const byteUtils = require('../../../lib/util/byte-limit')

describe('byte-limit', () => {
  describe('#isValidLength', () => {
    it('returns false when the string is larger than the limit', () => {
      expect(byteUtils.isValidLength('12345', 4)).to.equal(false)
    })

    it('returns true when the string is equal to the limit', () => {
      expect(byteUtils.isValidLength('12345', 5)).to.equal(true)
    })

    it('returns true when the string is smaller than the limit', () => {
      expect(byteUtils.isValidLength('12345', 6)).to.equal(true)
    })
  })
  describe('#compareLength', () => {
    it('returns -1 when the string is smaller than the limit', () => {
      const str = '123456789'
      const cmpVal = byteUtils.compareLength(str, 255)
      expect(cmpVal).to.be.lessThan(0)
    })
    it('returns 0 when the string is equal than the limit', () => {
      const str = '123456789'
      const cmpVal = byteUtils.compareLength(str, 9)
      expect(cmpVal).to.equal(0)
    })
    it('returns 1 when the string is larger than the limit', () => {
      const str = '123456789'
      const cmpVal = byteUtils.compareLength(str, 2)
      expect(cmpVal).to.be.greaterThan(0)
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
    it('should strings with split unicode characters properly', () => {
      let str = '\uD87E\uDC04\uD87E\uDC04'
      expect(Buffer.byteLength(str, 'utf8')).to.equal(8)
      str = byteUtils.truncate(str, 2)
      expect(str).to.equal('')
    })
  })
})
