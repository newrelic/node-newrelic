'use strict'

var common = require('../../../lib/utilization/common')
var expect = require('chai').expect

var BIG = 'abcd'
while (BIG.length < 300) {
  BIG += BIG
}

describe('Utilization Common Components', function() {
  describe('common.checkValueString', function() {
    it('should fail for strings of invalid size', function() {
      expect(common.checkValueString(null)).to.be.false
      expect(common.checkValueString({})).to.be.false
      expect(common.checkValueString('')).to.be.false

      expect(common.checkValueString(BIG)).to.be.false
    })

    it('should fail for strings with invalid characters', function() {
      expect(common.checkValueString('&')).to.be.false
      expect(common.checkValueString('foo\0')).to.be.false
    })

    it('should allow good values', function() {
      expect(common.checkValueString('foobar')).to.be.true
      expect(common.checkValueString('f1B_./- \xff')).to.be.true
    })
  })

  describe('common.getKeys', function() {
    it('should return null if any key is missing', function() {
      expect(common.getKeys({}, ['foo'])).to.be.null
      expect(common.getKeys({foo: 'bar'}, ['foo', 'bar'])).to.be.null
      expect(common.getKeys(null, ['foo'])).to.be.null
    })

    it('should return null if any key is invalid', function() {
      expect(common.getKeys({foo: 'foo\0'}, ['foo'])).to.be.null
      expect(common.getKeys({foo: 'foo', bar: 'bar\0'}, ['foo', 'bar'])).to.be.null
    })

    it('should return null if any value is too large', function() {
      expect(common.getKeys({foo: BIG}, ['foo'])).to.be.null
    })

    it('should pull only the desired values', function() {
      expect(common.getKeys({foo: 'foo', bar: 'bar', baz: 'baz'}, ['foo', 'baz']))
        .to.deep.equal({foo: 'foo', baz: 'baz'})
    })

    it('should not fail with "clean" objects', function() {
      var obj = Object.create(null)
      obj.foo = 'foo'
      expect(common.getKeys(obj, ['foo'])).to.deep.equal({foo: 'foo'})
    })
  })
})
