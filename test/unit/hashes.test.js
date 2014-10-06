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
