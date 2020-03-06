'use strict'

// TODO: convert to normal tap style.
// Below allows use of mocha DSL with tap runner.
require('tap').mochaGlobals()

var tests = require('../../lib/cross_agent_tests/sql_obfuscation/sql_obfuscation')
var obfuscate = require('../../../lib/util/sql/obfuscate')
var chai = require('chai')
var expect = chai.expect

describe('sql obfuscation', function testObfuscation() {
  tests.forEach(function load(test) {
    describe(test.name, function() {
      for (var i = 0; i < test.dialects.length; ++i) {
        runTest(test, test.dialects[i])
      }
    })
  })

  function runTest(test, dialect) {
    it(dialect, function() {
      var obfuscated = obfuscate(test.sql, dialect)
      if (test.obfuscated.length === 1) {
        expect(obfuscated).to.equal(test.obfuscated[0])
      } else {
        expect(test.obfuscated).to.contain(obfuscated)
      }
    })
  }

  it('should handle line endings', function lineEndings() {
    var result = obfuscate('select * from foo where --abc\r\nbar=5', 'mysql')
    expect(result).equal('select * from foo where ?\r\nbar=?')
  })
})
