'use strict'

var tests = require('../../lib/cross_agent_tests/sql_obfuscation/sql_obfuscation.json')
var obfuscate = require('../../../lib/util/sql/obfuscate')
var chai = require('chai')
var expect = chai.expect

describe('sql obfuscation', function testObfuscation() {
  tests.forEach(function load(test) {
    for (var i = 0; i < test.dialects.length; ++i) {
      runTest(test, test.dialects[i])
    }
  })

  function runTest(test, dialect) {
    it(dialect + ': ' + test.name, function() {
      var obfuscated = obfuscate(test.sql, dialect)
      expect(test.obfuscated).contain(obfuscated)
    })
  }

  it('should handle line endings', function lineEndings() {
    var result = obfuscate('select * from foo where --abc\r\nbar=5', 'mysql')
    expect(result).equal('select * from foo where ?\r\nbar=?')
  })
})
