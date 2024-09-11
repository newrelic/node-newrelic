/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const TxSegmentNormalizer = require('../../../lib/metrics/normalizer/tx_segment')
const txTestData = require('../../lib/cross_agent_tests/transaction_segment_terms')

test('The TxSegmentNormalizer', async (t) => {
  // iterate over the cross_agent_tests
  for (const test of txTestData) {
    // create the test and bind the test data to it.
    await t.test(`should be ${test.testname}`, () => {
      runTest(test)
    })
  }

  await t.test('should reject non array to load', () => {
    const normalizer = new TxSegmentNormalizer()
    normalizer.load(1)
    assert.ok(Array.isArray(normalizer.terms))
  })

  await t.test('should accept arrays to load', () => {
    const input = [
      {
        prefix: 'WebTrans/foo',
        terms: ['one', 'two']
      }
    ]
    const normalizer = new TxSegmentNormalizer()
    normalizer.load(input)
    assert.deepEqual(normalizer.terms, input)
  })
})

function runTest(data) {
  const normalizer = new TxSegmentNormalizer()
  normalizer.load(data.transaction_segment_terms)

  for (const test of data.tests) {
    assert.deepEqual(normalizer.normalize(test.input).value, test.expected)
  }
}
