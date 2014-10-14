var test_data = require('../../lib/cross_agent_tests/labels.json')
var parse = require('../../../lib/util/label-parser').fromString
var chai = require('chai')
var expect = chai.expect

describe('label praser', function() {
  it('should pass cross-agent tests', function() {
    test_data.forEach(function(example) {
      var result = parse(example.labelString)
      expect(result.labels.sort(by_type)).deep.equal(example.expected.sort(by_type))
      expect(!!result.warnings.length).deep.equal(example.warning)
    })
  })
})

function by_type(a, b) {
  return a.label_type < b.label_type
}
