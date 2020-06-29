/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var fs = require('fs')
var helper = require('../../lib/agent_helper')
var path = require('path')
var tap = require('tap')


tap.test('pricing pcf info', function(t) {
  var testFile = path.resolve(
    __dirname,
    '../../lib/cross_agent_tests/utilization_vendor_specific',
    'pcf.json'
  )
  var getInfo = require('../../../lib/utilization/pcf-info')

  fs.readFile(testFile, function(err, data) {
    if (err) {
      throw err
    }
    var cases = JSON.parse(data)

    t.autoend()
    t.ok(cases.length > 0, 'should have tests to run')

    for (var i = 0; i < cases.length; ++i) {
      t.test(cases[i].testname, makeTest(cases[i], getInfo))
    }
  })
})

function makeTest(testCase, getInfo) {
  return function(t) {
    var agent = helper.loadMockedAgent()
    t.tearDown(function() {
      helper.unloadAgent(agent)
    })

    Object.keys(testCase.env_vars).forEach(function(key) {
      var value = testCase.env_vars[key].response
      if (value == null) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    })

    getInfo(agent, function(err, info) {
      if (testCase.expected_vendors_hash) {
        var expected = testCase.expected_vendors_hash.pcf
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

  Object.keys(expectedMetrics).forEach(function(expectedMetric) {
    var metric = agent.metrics.getOrCreateMetric(expectedMetric)
    t.equal(
      metric.callCount,
      expectedMetrics[expectedMetric].call_count,
      'should have correct metric call count (' + expectedMetric + ')'
    )
  })
}
