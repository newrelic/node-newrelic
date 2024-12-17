/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const helper = require('../../lib/agent_helper')
const test = require('node:test')
const assert = require('node:assert')
const { checkMetrics, getTestCases } = require('./common')

test('pricing pcf info', async function (t) {
  const cases = await getTestCases('pcf')
  assert.ok(cases.length > 0, 'should have tests to run')
  const getInfo = require('../../../lib/utilization/pcf-info')

  t.beforeEach((ctx) => {
    const agent = helper.loadMockedAgent()
    ctx.nr = { agent }
  })

  t.afterEach((ctx) => {
    helper.unloadAgent(ctx.nr.agent)
  })

  for (const testCase of cases) {
    await t.test(testCase.testname, makeTest(testCase, getInfo))
  }
})

function makeTest(testCase, getInfo) {
  return function (t, end) {
    const { agent } = t.nr
    Object.keys(testCase.env_vars).forEach(function (key) {
      const value = testCase.env_vars[key].response
      if (value == null) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    })

    getInfo(agent, function (err, info) {
      if (testCase.expected_vendors_hash) {
        const expected = testCase.expected_vendors_hash.pcf
        assert.ok(!err, 'should not error getting data')
        assert.deepEqual(info, expected, 'should have expected info')
      } else {
        assert.ok(!info, 'should not have received vendor info')
      }

      checkMetrics(agent, testCase.expected_metrics)

      end()
    })
  }
}
