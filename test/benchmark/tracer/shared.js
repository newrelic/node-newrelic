/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const helper = require('../../lib/agent_helper')

function makeSuite(name) {
  const agent = helper.loadMockedAgent()
  const suite = benchmark.createBenchmark({ name: name, delay: 0.01 })
  return { agent: agent, suite: suite }
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
