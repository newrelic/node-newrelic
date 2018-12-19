'use strict'

var test_data = require('../lib/obfuscation-data')
var hashes = require('../../lib/util/hashes')
var expect = require('chai').expect

describe('obfuscation', function() {
  it('should objuscate strings correctly', function() {
    test_data.forEach(function(test) {
      expect(hashes.obfuscateNameUsingKey(test.input, test.key)).equal(test.output)
    })
  })
})

describe('deobfuscation', function() {
  it('should deobjuscate strings correctly', function() {
    test_data.forEach(function(test) {
      expect(hashes.deobfuscateNameUsingKey(test.output, test.key)).equal(test.input)
    })
  })
})

describe('getHash', function() {
  it('should not crash when changing the DEFAULT_ENCODING key on crypto', function() {
    var crypto = require('crypto')
    var oldEncoding = crypto.DEFAULT_ENCODING
    crypto.DEFAULT_ENCODING = 'utf-8'
    expect(hashes.getHash.bind(null, 'TEST_APP', 'TEST_TXN')).to.not.throw()
    crypto.DEFAULT_ENCODING = oldEncoding
  })
})
