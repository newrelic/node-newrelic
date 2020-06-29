/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var benchmark = require('../../lib/benchmark')
var helper = require('../../lib/agent_helper')
var Shim = require('../../../lib/shim/shim')

function makeSuite(name) {
  var agent = helper.loadMockedAgent()
  var shim = new Shim(agent, 'test-module', './')
  var suite = benchmark.createBenchmark({name: name, delay: 0.01})
  return {agent: agent, suite: suite, shim: shim}
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
