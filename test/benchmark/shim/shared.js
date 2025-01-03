/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../../lib/benchmark')
const helper = require('../../lib/agent_helper')
const Shim = require('../../../lib/shim/shim')

function makeSuite(name) {
  const agent = helper.loadMockedAgent()
  const shim = new Shim(agent, 'test-module', './')
  const suite = benchmark.createBenchmark({ name, delay: 0.01 })
  return { agent, suite, shim }
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
