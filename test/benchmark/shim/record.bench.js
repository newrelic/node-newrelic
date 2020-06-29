/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

var benchmark = require('../../lib/benchmark')
var helper = require('../../lib/agent_helper')
var Shim = require('../../../lib/shim/shim')

var agent = helper.loadMockedAgent()
var shim = new Shim(agent, 'test-module', './')
var suite = benchmark.createBenchmark({name: 'Shim#record'})

var transaction = helper.runInTransaction(agent, function(tx) { return tx })

suite.add({
  name: 'function',
  fn: function() {
    return shim.record(getTest().func, function() {})
  }
})

suite.add({
  name: 'property',
  fn: function() {
    return shim.record(getTest(), 'func', function() {})
  }
})

var wrapped = shim.record(getTest(), 'func', function() {
  return {name: 'foo', callback: shim.LAST}
})

suite.add({
  name: 'wrapper - no transaction',
  fn: function() {
    agent.tracer.segment = null
    wrapped.func(noop)
  }
})

suite.add({
  name: 'wrapper - in transaction',
  fn: function() {
    agent.tracer.segment = transaction.trace.root
    wrapped.func(noop)
  }
})

suite.run()

function getTest() {
  return {
    func: function(cb) {
      cb()
    }
  }
}

function noop() {}
