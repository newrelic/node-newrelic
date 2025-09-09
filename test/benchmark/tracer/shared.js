/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('#testlib/benchmark.js')
const helper = require('#testlib/agent_helper.js')

function makeSuite(name) {
  const agent = helper.loadMockedAgent()
  const suite = benchmark.createBenchmark({ name, delay: 0.01 })
  return { agent, suite }
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
