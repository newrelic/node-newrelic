/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const testData = require('../../lib/cross_agent_tests/labels.json')
const parse = require('../../../lib/util/label-parser').fromString

tap.test('label praser', (t) => {
  t.test('should pass cross-agent tests', (t) => {
    testData.forEach((example) => {
      const result = parse(example.labelString)
      t.same(result.labels.sort(byType), example.expected.sort(byType))
      t.same(!!result.warnings.length, example.warning)
    })
    t.end()
  })
  t.end()
})

function byType(a, b) {
  return a.label_type < b.label_type
}
