var chai = require('chai')
var expect = chai.expect
var TxSegmentNormalizer = require('../../../lib/metrics/normalizer/tx_segment.js')
var txTestData = require('../../lib/cross_agent_tests/transaction_segment_terms.json')

describe('The TxSegmentNormalizer', function () {
  // iterate over the cross_agent_tests
  for (var i = 0; i < txTestData.length; i++) {
    // create the test and bind the test data to it.
    it('should be ' + txTestData[i].testname, runTest.bind(null, txTestData[i]))
  }

  it('should reject non array to load', function () {
    var normalizer = new TxSegmentNormalizer()
    normalizer.load(1)
    expect(normalizer.terms).be.Array
  })

  it('should accept arrays to load', function () {
    var input = [
      {
        "prefix": "WebTrans/foo",
        "terms": ["one", "two"]
      }
    ]
    var normalizer = new TxSegmentNormalizer()
    normalizer.load(input)
    expect(normalizer.terms).deep.equal(input)
  })
})

function runTest(data) {
  var normalizer = new TxSegmentNormalizer()
  normalizer.load(data.transaction_segment_terms)

  for (var j = 0; j < data.tests.length; j++) {
    var test = data.tests[j]
    expect(normalizer.normalize(test.input)).equal(test.expected)
  }
}
