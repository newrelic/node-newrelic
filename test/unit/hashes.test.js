'use strict'

var test_data = require('../lib/obfuscation-data')
var hashes = require('../../lib/util/hashes')
var expect = require('chai').expect
var proxyquire = require('proxyquire')
var xtend = require('xtend')

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

describe('Buffer.from fallback logic', function() {
  var fromCalled = false

  function getBufferStub(shouldFail) {
    fromCalled = false

    return xtend(Buffer, {
      from: function(v, enc) {
        if (shouldFail) {
          throw new Error('Buffer.from was called when stub should be')
        }

        // Set to true - should only occur on node v4.5+
        fromCalled = true

        return new Buffer(v, enc)
      }
    })
  }

  function getModule(shouldUsePolyfill, version) {
    return proxyquire('../../lib/util/hashes', {
      'buffer': getBufferStub(shouldUsePolyfill),
      './process': {
        versions: {
          node: version
        }
      }
    })
  }

  it('should not use Buffer.from on v4.5 and above', function() {
    var p = getModule(false, '4.5.0')

    expect(p.obfuscateNameUsingKey(test_data[0].input, test_data[0].key))
      .equal(test_data[0].output)

    expect(fromCalled).equal(true)
  })

  it('should use the fallback on node version v4.4.x', function() {
    var p = getModule(true, '4.4.3')

    expect(p.obfuscateNameUsingKey(test_data[0].input, test_data[0].key))
      .equal(test_data[0].output)

    expect(fromCalled).equal(false)
  })

  it('should use the fallback on node version v0.12.x', function() {
    var p = getModule(true, '0.12.0')

    expect(p.obfuscateNameUsingKey(test_data[0].input, test_data[0].key))
      .equal(test_data[0].output)

    expect(fromCalled).equal(false)
  })

  it('should use the fallback on node version v0.10.x', function() {
    var p = getModule(true, '0.10.33')

    expect(p.obfuscateNameUsingKey(test_data[0].input, test_data[0].key))
      .equal(test_data[0].output)

    expect(fromCalled).equal(false)
  })
})
