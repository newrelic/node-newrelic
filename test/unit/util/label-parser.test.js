/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const testData = require('../../lib/cross_agent_tests/labels.json')
const parse = require('../../../lib/util/label-parser').fromString

test('label parser should pass cross-agent tests', () => {
  testData.forEach((example) => {
    const result = parse(example.labelString)
    assert.deepEqual(result.labels.sort(byType), example.expected.sort(byType))
    assert.equal(!!result.warnings.length, example.warning)
  })
})

function byType(a, b) {
  return a.label_type < b.label_type
}
