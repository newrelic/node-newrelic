/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test_data = require('../../lib/cross_agent_tests/labels.json')
const parse = require('../../../lib/util/label-parser').fromString

tap.test('label praser', (t) => {
  t.test('should pass cross-agent tests', (t) => {
    test_data.forEach((example) => {
      const result = parse(example.labelString)
      t.deepEqual(result.labels.sort(by_type), example.expected.sort(by_type))
      t.deepEqual(!!result.warnings.length, example.warning)
    })
    t.end()
  })
  t.end()
})

function by_type(a, b) {
  return a.label_type < b.label_type
}
