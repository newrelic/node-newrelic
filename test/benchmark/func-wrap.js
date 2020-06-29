/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var benchmark = require('../lib/benchmark')
var helper = require('../lib/agent_helper')
var Shim = require('../../lib/shim/shim')
var shimmer = require('../../lib/shimmer')

var agent = helper.loadMockedAgent()
var shim = new Shim(agent, 'test-module')
var suite = benchmark.createBenchmark({
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
  fn: function() {
    var test = getTest()
    shim.wrap(test, 'func', function(shim, fn) {
      return function() { return fn.apply(this, arguments) }
    })
    return test
  }
})

suite.add({
  name: 'shimmer.wrapMethod',
  fn: function() {
    var test = getTest()
    shimmer.wrapMethod(test, 'test', 'func', function(fn) {
      return function() { return fn.apply(this, arguments) }
    })
    return test
  }
})

suite.add({
  name: 'IIFE',
  fn: function() {
    var test = getTest()
    test.func = (function(fn) {
      return function() { return fn.apply(this, arguments) }
    }(test.func))
    return test
  }
})

suite.run()
