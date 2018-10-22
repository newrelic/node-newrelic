'use strict'

const expect = require('chai').expect
const byteUtils = require('../../../lib/util/byte-limit')

describe('byte-limit', () => {
  describe('#compareLength', () => {
    it('returns -1 when the string is smaller than the limit', () => {
      const str = '123456789'
      const cmpVal = byteUtils.compareLength(str, 255)
      expect(cmpVal).to.equal(-1)
    })
    it('returns 0 when the string is equal than the limit', () => {
      const str = '123456789'
      const cmpVal = byteUtils.compareLength(str, 9)
      expect(cmpVal).to.equal(0)
    })
    it('returns 1 when the string is larger than the limit', () => {
      const str = '123456789'
      const cmpVal = byteUtils.compareLength(str, 2)
      expect(cmpVal).to.equal(1)
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
