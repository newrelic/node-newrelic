/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const benchmark = require('../lib/benchmark')
const helper = require('../lib/agent_helper')
const Shim = require('../../lib/shim/shim')
const shimmer = require('../../lib/shimmer')

const agent = helper.loadMockedAgent()
const shim = new Shim(agent, 'test-module')
const suite = benchmark.createBenchmark({
  name: 'function wrapping'
})

function getTest() {
  return {
    func: function testFunc(a, b, c) {
      return a + b + c
    }
  }
}

suite.add({
  name: 'shim.wrap',
  fn: function () {
    const test = getTest()
    shim.wrap(test, 'func', function (shim, fn) {
      return function () {
        return fn.apply(this, arguments)
      }
    })
    return test
  }
})

suite.add({
  name: 'shimmer.wrapMethod',
  fn: function () {
    const test = getTest()
    shimmer.wrapMethod(test, 'test', 'func', function (fn) {
      return function () {
        return fn.apply(this, arguments)
      }
    })
    return test
  }
})

suite.add({
  name: 'IIFE',
  fn: function () {
    const test = getTest()
    test.func = (function (fn) {
      return function () {
        return fn.apply(this, arguments)
      }
    }(test.func)) // eslint-disable-line prettier/prettier
    return test
  }
})

suite.run()
