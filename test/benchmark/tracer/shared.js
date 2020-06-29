/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var benchmark = require('../../lib/benchmark')
var helper = require('../../lib/agent_helper')

function makeSuite(name) {
  var agent = helper.loadMockedAgent()
  var suite = benchmark.createBenchmark({name: name, delay: 0.01})
  return {agent: agent, suite: suite}
}

function getTest() {
  return {
    func: function testFunc(a, b, c) {
      return a + b + c
    }
  }
}

exports.makeSuite = makeSuite
exports.getTest = getTest
