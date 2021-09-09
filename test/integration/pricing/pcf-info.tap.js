/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const fs = require('fs')
const helper = require('../../lib/agent_helper')
const path = require('path')
const tap = require('tap')

tap.test('pricing pcf info', function (t) {
  const testFile = path.resolve(
    __dirname,
    '../../lib/cross_agent_tests/utilization_vendor_specific',
    'pcf.json'
  )
  const getInfo = require('../../../lib/utilization/pcf-info')

  fs.readFile(testFile, function (err, data) {
    if (err) {
      throw err
    }
    const cases = JSON.parse(data)

    t.autoend()
    t.ok(cases.length > 0, 'should have tests to run')

    for (let i = 0; i < cases.length; ++i) {
      t.test(cases[i].testname, makeTest(cases[i], getInfo))
    }
  })
})

function makeTest(testCase, getInfo) {
  return function (t) {
    const agent = helper.loadMockedAgent()
    t.teardown(function () {
      helper.unloadAgent(agent)
    })

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
        t.error(err, 'should not error getting data')
        t.same(info, expected, 'should have expected info')
      } else {
        t.notOk(info, 'should not have received vendor info')
      }

      checkMetrics(t, agent, testCase.expected_metrics)

      t.end()
    })
  }
}

function checkMetrics(t, agent, expectedMetrics) {
  if (!expectedMetrics) {
    t.equal(agent.metrics._metrics.toJSON().length, 0, 'should not have any metrics')
    return
  }

  Object.keys(expectedMetrics).forEach(function (expectedMetric) {
    const metric = agent.metrics.getOrCreateMetric(expectedMetric)
    t.equal(
      metric.callCount,
      expectedMetrics[expectedMetric].call_count,
      'should have correct metric call count (' + expectedMetric + ')'
    )
  })
}
