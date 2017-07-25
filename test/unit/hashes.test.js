var test_data = require('../lib/obfuscation-data')
var hashes = require('../../lib/util/hashes')
var expect = require('chai').expect
var semver = require('semver')

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

describe('buffers', function() {
  var processVersion = Object.getOwnPropertyDescriptor(process, 'version')
  var oldBuffer = global.Buffer
  var oldFrom = global.Buffer.from
  var testInput = test_data[0]

  beforeEach(function() {
    delete require.cache[require.resolve('../../lib/util/hashes')]
  })

  afterEach(function() {
    global.Buffer = oldBuffer
    global.Buffer.from = oldFrom
    Object.defineProperty(process, 'version', processVersion)
  })

  it('should call the buffer constructor on versions <5.10', function() {
    var constructorCalled = false
    Object.defineProperty(process, 'version', {
      value: 'v4.3.0'
    })

    global.Buffer = function fakeConstructor() {
      constructorCalled = true
      var args = arguments
      function stub() {
        return oldBuffer.apply(this, args)
      }
      stub.prototype = oldBuffer.prototype
      return new stub()
    }

    global.Buffer.prototype = oldBuffer.prototype

    Buffer.from = function pleaseDoNotCallMe() {
      throw new Error('i told you not to do it')
    }

    var hashes = require('../../lib/util/hashes')

    expect(
      hashes.obfuscateNameUsingKey(testInput.input, testInput.key)
    ).to.equal(testInput.output)

    expect(constructorCalled).to.be.true
  })

  it('should call the Buffer.from on >=5.10', function() {
    if (semver.satisfies(process.version, '<5.10')) {
      this.skip()
    }

    var fromCalled = false
    Buffer.from = function pleaseCallMe() {
      fromCalled = true
      return oldFrom.apply(Buffer, arguments)
    }

    var hashes = require('../../lib/util/hashes')

    expect(
      hashes.obfuscateNameUsingKey(testInput.input, testInput.key)
    ).to.equal(testInput.output)

    expect(fromCalled).to.be.true
  })
})
