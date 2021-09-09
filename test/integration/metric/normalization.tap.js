/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('tap').test
const ruleTests = require('../../lib/cross_agent_tests/rules')
const Config = require('../../../lib/config')
const Normalizer = require('../../../lib/metrics/normalizer')

test('metric normalization', function (t) {
  t.plan(1)

  t.test('cross agent tests', function (t) {
    t.plan(ruleTests.length)
    const config = new Config({})

    ruleTests.forEach(function (rulesTest) {
      t.test(rulesTest.testname, function (t) {
        t.plan(rulesTest.tests.length * 2)

        const normalizer = new Normalizer(config, 'Url')
        normalizer.load(rulesTest.rules)

        rulesTest.tests.forEach(function (io) {
          const normalized = normalizer.normalize(io.input)

          if (io.expected === null) {
            t.pass('ignored, not checking name')
            t.ok(normalized.ignore, 'should ignore ' + io.input)
          } else {
            t.equal(
              normalized.value,
              io.expected,
              'should normalize ' + io.input + ' to ' + io.expected
            )
            t.notOk(normalized.ignore, 'should not ignore ' + io.input)
          }
        })
      })
    })
  })
})
