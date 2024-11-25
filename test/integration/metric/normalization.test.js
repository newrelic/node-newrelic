/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const tspl = require('@matteo.collina/tspl')

const ruleTests = require('../../lib/cross_agent_tests/rules')
const Config = require('../../../lib/config')
const Normalizer = require('../../../lib/metrics/normalizer')

test('cross agent tests', async (t) => {
  for (const ruleTest of ruleTests) {
    await t.test(ruleTest.testname, async (t) => {
      const plan = tspl(t, { plan: ruleTest.tests.length * 2 })
      const config = new Config({})

      const normalizer = new Normalizer(config, 'Url')
      normalizer.load(ruleTest.rules)

      ruleTest.tests.forEach(function (io) {
        const normalized = normalizer.normalize(io.input)

        if (io.expected === null) {
          plan.ok('ignored, not checking name')
          plan.ok(normalized.ignore, 'should ignore ' + io.input)
        } else {
          plan.equal(
            normalized.value,
            io.expected,
            'should normalize ' + io.input + ' to ' + io.expected
          )
          plan.equal(normalized.ignore, false, 'should not ignore ' + io.input)
        }
      })
    })
  }
})
