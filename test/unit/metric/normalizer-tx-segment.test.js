/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')

const TxSegmentNormalizer = require('../../../lib/metrics/normalizer/tx_segment')
const txTestData = require('../../lib/cross_agent_tests/transaction_segment_terms')

tap.test('The TxSegmentNormalizer', (t) => {
  // iterate over the cross_agent_tests
  for (var i = 0; i < txTestData.length; i++) {
    // create the test and bind the test data to it.
    t.test('should be ' + txTestData[i].testname, (t) => { runTest(t, txTestData[i]) })
  }

  t.test('should reject non array to load', (t) => {
    const normalizer = new TxSegmentNormalizer()
    normalizer.load(1)
    t.ok(Array.isArray(normalizer.terms))
    t.end()
  })

  t.test('should accept arrays to load', (t) => {
    const input = [{
      prefix: 'WebTrans/foo',
      terms: ['one', 'two']
    }]
    const normalizer = new TxSegmentNormalizer()
    normalizer.load(input)
    t.deepEqual(normalizer.terms, input)
    t.end()
  })

  t.end()
})

function runTest(t, data) {
  const normalizer = new TxSegmentNormalizer()
  normalizer.load(data.transaction_segment_terms)

  for (var j = 0; j < data.tests.length; j++) {
    const test = data.tests[j]
    t.hasStrict(normalizer.normalize(test.input), { 'value': test.expected })
  }

  t.end()
}
